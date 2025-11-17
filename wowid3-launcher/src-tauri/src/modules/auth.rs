//! Microsoft OAuth 2.0 authentication module for Minecraft Java Edition.
//!
//! This module implements the complete Microsoft authentication flow required to
//! authenticate with Minecraft Java Edition. The flow consists of several steps:
//!
//! 1. **Microsoft OAuth**: User authenticates with their Microsoft account via OAuth 2.0
//!    using PKCE (Proof Key for Code Exchange) for enhanced security.
//! 2. **Xbox Live Authentication**: Microsoft token is exchanged for an Xbox Live token.
//! 3. **XSTS Authentication**: Xbox Live token is used to obtain an XSTS (Xbox Secure Token Service) token.
//! 4. **Minecraft Authentication**: XSTS token is used to obtain a Minecraft access token.
//! 5. **Profile Retrieval**: Minecraft token is used to fetch the player's profile and verify ownership.
//!
//! ## Security Features
//!
//! - Uses PKCE for OAuth to prevent authorization code interception attacks
//! - Stores credentials securely in the system keyring
//! - Implements token refresh to avoid repeated user authentication
//! - Validates Minecraft ownership before granting access
//!
//! ## Token Management
//!
//! Tokens are automatically refreshed when they expire (with a 5-minute buffer).
//! The refresh token is preserved across authentication cycles to enable
//! seamless token renewal without user interaction.

use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Duration, Utc};
use keyring::Entry;
use oauth2::{
    basic::BasicClient, AuthUrl, AuthorizationCode, ClientId, CsrfToken, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, RefreshToken, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration as StdDuration, Instant};

const KEYRING_SERVICE: &str = "wowid3-launcher";
const KEYRING_USER: &str = "minecraft-auth";

// Microsoft OAuth constants
/// Microsoft Azure AD client ID for Minecraft authentication.
///
/// This is the official client ID used by Minecraft launchers for Microsoft OAuth.
/// Source: This ID is publicly available and used by the official Minecraft launcher
/// and other third-party launchers for authenticating with Microsoft accounts.
const MICROSOFT_CLIENT_ID: &str = "00000000402b5328";
const MICROSOFT_AUTH_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const REDIRECT_URI: &str = "http://localhost:23947/callback";

// Xbox Live & Minecraft API endpoints
const XBOX_LIVE_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_AUTH_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";
const MINECRAFT_ENTITLEMENTS_URL: &str = "https://api.minecraftservices.com/entitlements/mcstore";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftProfile {
    pub uuid: String,
    pub username: String,
    pub access_token: String,
    pub skin_url: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
struct MicrosoftTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
}

#[derive(Debug, Serialize)]
struct XboxLiveAuthRequest {
    #[serde(rename = "Properties")]
    properties: XboxLiveProperties,
    #[serde(rename = "RelyingParty")]
    relying_party: String,
    #[serde(rename = "TokenType")]
    token_type: String,
}

#[derive(Debug, Serialize)]
struct XboxLiveProperties {
    #[serde(rename = "AuthMethod")]
    auth_method: String,
    #[serde(rename = "SiteName")]
    site_name: String,
    #[serde(rename = "RpsTicket")]
    rps_ticket: String,
}

#[derive(Debug, Deserialize)]
struct XboxLiveAuthResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: DisplayClaims,
}

#[derive(Debug, Deserialize)]
struct DisplayClaims {
    xui: Vec<XuiClaim>,
}

#[derive(Debug, Deserialize)]
struct XuiClaim {
    uhs: String,
}

#[derive(Debug, Serialize)]
struct XSTSAuthRequest {
    #[serde(rename = "Properties")]
    properties: XSTSProperties,
    #[serde(rename = "RelyingParty")]
    relying_party: String,
    #[serde(rename = "TokenType")]
    token_type: String,
}

#[derive(Debug, Serialize)]
struct XSTSProperties {
    #[serde(rename = "SandboxId")]
    sandbox_id: String,
    #[serde(rename = "UserTokens")]
    user_tokens: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct XSTSAuthResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: DisplayClaims,
}

#[derive(Debug, Serialize)]
struct MinecraftAuthRequest {
    #[serde(rename = "identityToken")]
    identity_token: String,
}

#[derive(Debug, Deserialize)]
struct MinecraftAuthResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct MinecraftProfileResponse {
    id: String,
    name: String,
    skins: Option<Vec<MinecraftSkin>>,
}

#[derive(Debug, Deserialize)]
struct MinecraftSkin {
    url: String,
    variant: String,
}

#[derive(Debug, Deserialize)]
struct MinecraftEntitlement {
    items: Vec<MinecraftItem>,
}

#[derive(Debug, Deserialize)]
struct MinecraftItem {
    name: String,
}

/// Start local HTTP server and wait for OAuth callback
fn start_oauth_server() -> Result<(String, PkceCodeVerifier)> {
    let listener = TcpListener::bind("127.0.0.1:23947")
        .context("Failed to bind to port 23947. Is another instance running?")?;

    // Set non-blocking mode for timeout support
    listener
        .set_nonblocking(true)
        .context("Failed to set listener to non-blocking mode")?;

    // Generate PKCE challenge
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    // Build OAuth client
    let client = BasicClient::new(
        ClientId::new(MICROSOFT_CLIENT_ID.to_string()),
        None,
        AuthUrl::new(MICROSOFT_AUTH_URL.to_string())?,
        Some(TokenUrl::new(MICROSOFT_TOKEN_URL.to_string())?),
    )
    .set_redirect_uri(RedirectUrl::new(REDIRECT_URI.to_string())?);

    // Generate authorization URL
    let (auth_url, _csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("XboxLive.signin".to_string()))
        .add_scope(Scope::new("offline_access".to_string()))
        .set_pkce_challenge(pkce_challenge)
        .url();

    // Open browser
    println!("Opening browser for authentication: {}", auth_url);
    if let Err(e) = open::that(auth_url.as_str()) {
        eprintln!("Failed to open browser automatically: {}. Please open this URL manually: {}", e, auth_url);
    }

    // Wait for callback with 5-minute timeout
    println!("Waiting for OAuth callback on port 23947...");
    let timeout = StdDuration::from_secs(300); // 5 minutes
    let start_time = Instant::now();

    loop {
        // Check if timeout has elapsed
        if start_time.elapsed() > timeout {
            return Err(anyhow!(
                "OAuth authentication timed out after 5 minutes. Please try again."
            ));
        }

        // Try to accept a connection (non-blocking)
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut reader = BufReader::new(&stream);
                let mut request_line = String::new();

                if let Err(e) = reader.read_line(&mut request_line) {
                    eprintln!("Failed to read request line: {}", e);
                    continue;
                }

                // Parse the request path
                let request_path = match request_line.split_whitespace().nth(1) {
                    Some(path) => path,
                    None => {
                        eprintln!("Invalid request format, ignoring");
                        continue;
                    }
                };

                // Parse URL and look for authorization code
                let url = match url::Url::parse(&format!("http://localhost{}", request_path)) {
                    Ok(url) => url,
                    Err(_) => {
                        // Not a valid URL, might be favicon.ico or other browser request
                        eprintln!("Ignoring non-OAuth request: {}", request_path);
                        continue;
                    }
                };

                // Check if this request has an authorization code
                if let Some((_, code_value)) = url.query_pairs().find(|(key, _)| key == "code") {
                    let code = code_value.to_string();

                    // Send success response to browser
                    let response = "HTTP/1.1 200 OK\r\n\r\n\
                        <html><body><h1>Authentication Successful!</h1>\
                        <p>You can close this window and return to the launcher.</p>\
                        <script>window.close();</script></body></html>";

                    if let Err(e) = stream.write_all(response.as_bytes()) {
                        eprintln!("Failed to send response to browser: {}", e);
                    }
                    if let Err(e) = stream.flush() {
                        eprintln!("Failed to flush response: {}", e);
                    }

                    return Ok((code, pkce_verifier));
                } else {
                    // Request doesn't have a code parameter, might be favicon or other request
                    eprintln!("Ignoring request without authorization code: {}", request_path);

                    // Send a simple response to close the connection gracefully
                    let response = "HTTP/1.1 404 Not Found\r\n\r\n";
                    let _ = stream.write_all(response.as_bytes());
                    let _ = stream.flush();
                    continue;
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No connection ready yet, sleep briefly and try again
                std::thread::sleep(StdDuration::from_millis(100));
                continue;
            }
            Err(e) => {
                return Err(anyhow!("Failed to accept connection: {}", e));
            }
        }
    }
}

/// Exchange authorization code for Microsoft access token
async fn exchange_code_for_token(
    code: String,
    pkce_verifier: PkceCodeVerifier,
) -> Result<MicrosoftTokenResponse> {
    let client = BasicClient::new(
        ClientId::new(MICROSOFT_CLIENT_ID.to_string()),
        None,
        AuthUrl::new(MICROSOFT_AUTH_URL.to_string())?,
        Some(TokenUrl::new(MICROSOFT_TOKEN_URL.to_string())?),
    )
    .set_redirect_uri(RedirectUrl::new(REDIRECT_URI.to_string())?);

    let token_result = client
        .exchange_code(AuthorizationCode::new(code))
        .set_pkce_verifier(pkce_verifier)
        .request_async(oauth2::reqwest::async_http_client)
        .await
        .context("Failed to exchange authorization code for access token")?;

    Ok(MicrosoftTokenResponse {
        access_token: token_result.access_token().secret().to_string(),
        refresh_token: token_result.refresh_token().map(|t| t.secret().to_string()),
        expires_in: token_result
            .expires_in()
            .map(|d| d.as_secs())
            .unwrap_or(3600),
    })
}

/// Authenticate with Xbox Live using Microsoft token
async fn authenticate_with_xbox_live(ms_access_token: &str) -> Result<(String, String)> {
    let client = reqwest::Client::new();

    let request_body = XboxLiveAuthRequest {
        properties: XboxLiveProperties {
            auth_method: "RPS".to_string(),
            site_name: "user.auth.xboxlive.com".to_string(),
            rps_ticket: format!("d={}", ms_access_token),
        },
        relying_party: "http://auth.xboxlive.com".to_string(),
        token_type: "JWT".to_string(),
    };

    let response = client
        .post(XBOX_LIVE_AUTH_URL)
        .json(&request_body)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .send()
        .await
        .context("Failed to send Xbox Live authentication request")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(anyhow!(
            "Xbox Live authentication failed with status {}: {}",
            status,
            text
        ));
    }

    let xbox_response: XboxLiveAuthResponse = response
        .json()
        .await
        .context("Failed to parse Xbox Live authentication response")?;

    let user_hash = xbox_response
        .display_claims
        .xui
        .first()
        .ok_or_else(|| anyhow!("No user hash in Xbox Live response"))?
        .uhs
        .clone();

    Ok((xbox_response.token, user_hash))
}

/// Get XSTS token using Xbox Live token
async fn get_xsts_token(xbox_token: &str) -> Result<(String, String)> {
    let client = reqwest::Client::new();

    let request_body = XSTSAuthRequest {
        properties: XSTSProperties {
            sandbox_id: "RETAIL".to_string(),
            user_tokens: vec![xbox_token.to_string()],
        },
        relying_party: "rp://api.minecraftservices.com/".to_string(),
        token_type: "JWT".to_string(),
    };

    let response = client
        .post(XSTS_AUTH_URL)
        .json(&request_body)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .send()
        .await
        .context("Failed to send XSTS authentication request")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(anyhow!(
            "XSTS authentication failed with status {}: {}. This may mean you don't have an Xbox account or need to accept Xbox terms.",
            status,
            text
        ));
    }

    let xsts_response: XSTSAuthResponse = response
        .json()
        .await
        .context("Failed to parse XSTS authentication response")?;

    let user_hash = xsts_response
        .display_claims
        .xui
        .first()
        .ok_or_else(|| anyhow!("No user hash in XSTS response"))?
        .uhs
        .clone();

    Ok((xsts_response.token, user_hash))
}

/// Authenticate with Minecraft using XSTS token
async fn authenticate_minecraft_token(xsts_token: &str, user_hash: &str) -> Result<String> {
    let client = reqwest::Client::new();

    let identity_token = format!("XBL3.0 x={};{}", user_hash, xsts_token);
    let request_body = MinecraftAuthRequest { identity_token };

    let response = client
        .post(MINECRAFT_AUTH_URL)
        .json(&request_body)
        .header("Content-Type", "application/json")
        .send()
        .await
        .context("Failed to send Minecraft authentication request")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(anyhow!(
            "Minecraft authentication failed with status {}: {}",
            status,
            text
        ));
    }

    let mc_response: MinecraftAuthResponse = response
        .json()
        .await
        .context("Failed to parse Minecraft authentication response")?;

    Ok(mc_response.access_token)
}

/// Check if user owns Minecraft
async fn check_minecraft_ownership(mc_access_token: &str) -> Result<bool> {
    let client = reqwest::Client::new();

    let response = client
        .get(MINECRAFT_ENTITLEMENTS_URL)
        .bearer_auth(mc_access_token)
        .send()
        .await
        .context("Failed to check Minecraft ownership")?;

    if !response.status().is_success() {
        return Ok(false);
    }

    let entitlements: MinecraftEntitlement = response
        .json()
        .await
        .context("Failed to parse Minecraft entitlements")?;

    // Check if user owns Minecraft (either Java or combined)
    Ok(entitlements
        .items
        .iter()
        .any(|item| item.name == "product_minecraft" || item.name == "game_minecraft"))
}

/// Fetch Minecraft player profile
async fn get_minecraft_profile(mc_access_token: &str) -> Result<MinecraftProfileResponse> {
    let client = reqwest::Client::new();

    let response = client
        .get(MINECRAFT_PROFILE_URL)
        .bearer_auth(mc_access_token)
        .send()
        .await
        .context("Failed to fetch Minecraft profile")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(anyhow!(
            "Failed to fetch Minecraft profile with status {}: {}. User may not own Minecraft.",
            status,
            text
        ));
    }

    response
        .json()
        .await
        .context("Failed to parse Minecraft profile")
}

/// Microsoft OAuth authentication flow for Minecraft
pub async fn authenticate_minecraft() -> Result<MinecraftProfile> {
    println!("Starting Microsoft OAuth authentication...");

    // Step 1: Get authorization code from OAuth flow
    let (code, pkce_verifier) = start_oauth_server()?;
    println!("Received authorization code");

    // Step 2: Exchange code for Microsoft access token
    let ms_token = exchange_code_for_token(code, pkce_verifier).await?;
    println!("Obtained Microsoft access token");

    // Step 3: Authenticate with Xbox Live
    let (xbox_token, _xbox_user_hash) = authenticate_with_xbox_live(&ms_token.access_token).await?;
    println!("Authenticated with Xbox Live");

    // Step 4: Get XSTS token
    let (xsts_token, user_hash) = get_xsts_token(&xbox_token).await?;
    println!("Obtained XSTS token");

    // Step 5: Authenticate with Minecraft
    let mc_access_token = authenticate_minecraft_token(&xsts_token, &user_hash).await?;
    println!("Authenticated with Minecraft");

    // Step 6: Check game ownership
    let owns_minecraft = check_minecraft_ownership(&mc_access_token).await?;
    if !owns_minecraft {
        return Err(anyhow!(
            "This Microsoft account does not own Minecraft Java Edition"
        ));
    }
    println!("Verified Minecraft ownership");

    // Step 7: Fetch player profile
    let profile_response = get_minecraft_profile(&mc_access_token).await?;
    println!("Fetched player profile: {}", profile_response.name);

    // Calculate token expiration
    let expires_at = Utc::now() + Duration::seconds(ms_token.expires_in as i64);

    // Build final profile
    let profile = MinecraftProfile {
        uuid: profile_response.id,
        username: profile_response.name,
        access_token: mc_access_token,
        skin_url: profile_response
            .skins
            .and_then(|skins| skins.first().map(|s| s.url.clone())),
        refresh_token: ms_token.refresh_token,
        expires_at: Some(expires_at),
    };

    // Save to keyring
    save_user_profile(&profile)?;
    println!("Saved profile to secure storage");

    Ok(profile)
}

/// Get current authenticated user from keyring
pub fn get_current_user() -> Result<Option<MinecraftProfile>> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;

    match entry.get_password() {
        Ok(json) => {
            let profile: MinecraftProfile = serde_json::from_str(&json)?;
            Ok(Some(profile))
        }
        Err(_) => Ok(None),
    }
}

/// Save user profile to keyring
pub fn save_user_profile(profile: &MinecraftProfile) -> Result<()> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    let json = serde_json::to_string(profile)?;
    entry.set_password(&json)?;
    Ok(())
}

/// Logout and clear stored credentials
pub fn logout() -> Result<()> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    entry.delete_credential()?;
    Ok(())
}

/// Check if token is expired or will expire soon
fn is_token_expired(expires_at: &Option<DateTime<Utc>>) -> bool {
    match expires_at {
        Some(expiry) => {
            let now = Utc::now();
            let buffer = Duration::minutes(5);
            *expiry <= now + buffer
        }
        None => true, // If no expiry info, assume expired
    }
}

/// Refresh expired OAuth token
pub async fn refresh_token() -> Result<MinecraftProfile> {
    // Get current profile with refresh token
    let current_profile = get_current_user()?
        .ok_or_else(|| anyhow!("No user logged in"))?;

    let refresh_token = current_profile
        .refresh_token
        .clone()
        .ok_or_else(|| anyhow!("No refresh token available"))?;

    // Check if token actually needs refresh
    if !is_token_expired(&current_profile.expires_at) {
        return Ok(current_profile);
    }

    println!("Refreshing expired access token...");

    // Build OAuth client
    let client = BasicClient::new(
        ClientId::new(MICROSOFT_CLIENT_ID.to_string()),
        None,
        AuthUrl::new(MICROSOFT_AUTH_URL.to_string())?,
        Some(TokenUrl::new(MICROSOFT_TOKEN_URL.to_string())?),
    )
    .set_redirect_uri(RedirectUrl::new(REDIRECT_URI.to_string())?);

    // Request new token using refresh token
    let token_result = client
        .exchange_refresh_token(&RefreshToken::new(refresh_token))
        .request_async(oauth2::reqwest::async_http_client)
        .await
        .context("Failed to refresh access token")?;

    let ms_token = MicrosoftTokenResponse {
        access_token: token_result.access_token().secret().to_string(),
        refresh_token: token_result
            .refresh_token()
            .map(|t| t.secret().to_string()),
        expires_in: token_result
            .expires_in()
            .map(|d| d.as_secs())
            .unwrap_or(3600),
    };

    println!("Obtained new Microsoft access token");

    // Re-authenticate through Xbox Live -> XSTS -> Minecraft chain
    let (xbox_token, _) = authenticate_with_xbox_live(&ms_token.access_token).await?;
    let (xsts_token, user_hash) = get_xsts_token(&xbox_token).await?;
    let mc_access_token = authenticate_minecraft_token(&xsts_token, &user_hash).await?;

    println!("Re-authenticated with Minecraft");

    // Update profile with new tokens
    let expires_at = Utc::now() + Duration::seconds(ms_token.expires_in as i64);
    let updated_profile = MinecraftProfile {
        access_token: mc_access_token,
        refresh_token: ms_token.refresh_token.or(current_profile.refresh_token),
        expires_at: Some(expires_at),
        ..current_profile
    };

    // Save updated profile
    save_user_profile(&updated_profile)?;
    println!("Refreshed tokens saved to secure storage");

    Ok(updated_profile)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_expiry_check() {
        // Token expired 1 hour ago
        let expired = Some(Utc::now() - Duration::hours(1));
        assert!(is_token_expired(&expired));

        // Token expires in 10 minutes (within buffer, should be considered expired)
        let expiring_soon = Some(Utc::now() + Duration::minutes(3));
        assert!(is_token_expired(&expiring_soon));

        // Token expires in 1 hour (should be valid)
        let valid = Some(Utc::now() + Duration::hours(1));
        assert!(!is_token_expired(&valid));

        // No expiry info
        assert!(is_token_expired(&None));
    }

    #[test]
    fn test_profile_serialization() {
        let profile = MinecraftProfile {
            uuid: "test-uuid".to_string(),
            username: "TestPlayer".to_string(),
            access_token: "test-token".to_string(),
            skin_url: Some("https://example.com/skin.png".to_string()),
            refresh_token: Some("refresh-token".to_string()),
            expires_at: Some(Utc::now()),
        };

        // Test serialization
        let json = serde_json::to_string(&profile).unwrap();
        assert!(json.contains("test-uuid"));
        assert!(json.contains("TestPlayer"));

        // Test deserialization
        let deserialized: MinecraftProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.uuid, profile.uuid);
        assert_eq!(deserialized.username, profile.username);
    }

    #[test]
    fn test_profile_without_optional_fields() {
        let profile = MinecraftProfile {
            uuid: "uuid-123".to_string(),
            username: "Player".to_string(),
            access_token: "token-abc".to_string(),
            skin_url: None,
            refresh_token: None,
            expires_at: None,
        };

        // Should serialize and deserialize even without optional fields
        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: MinecraftProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.uuid, "uuid-123");
        assert_eq!(deserialized.username, "Player");
        assert_eq!(deserialized.skin_url, None);
        assert_eq!(deserialized.refresh_token, None);
        assert_eq!(deserialized.expires_at, None);
    }

    #[test]
    fn test_xbox_live_auth_request_serialization() {
        let request = XboxLiveAuthRequest {
            properties: XboxLiveProperties {
                auth_method: "RPS".to_string(),
                site_name: "user.auth.xboxlive.com".to_string(),
                rps_ticket: "d=test_token".to_string(),
            },
            relying_party: "http://auth.xboxlive.com".to_string(),
            token_type: "JWT".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();

        // Check that fields are properly capitalized (as required by Xbox API)
        assert!(json.contains("\"Properties\""));
        assert!(json.contains("\"RelyingParty\""));
        assert!(json.contains("\"TokenType\""));
        assert!(json.contains("\"AuthMethod\""));
        assert!(json.contains("\"SiteName\""));
        assert!(json.contains("\"RpsTicket\""));
    }

    #[test]
    fn test_xsts_auth_request_serialization() {
        let request = XSTSAuthRequest {
            properties: XSTSProperties {
                sandbox_id: "RETAIL".to_string(),
                user_tokens: vec!["token1".to_string()],
            },
            relying_party: "rp://api.minecraftservices.com/".to_string(),
            token_type: "JWT".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();

        // Check proper capitalization
        assert!(json.contains("\"Properties\""));
        assert!(json.contains("\"SandboxId\""));
        assert!(json.contains("\"UserTokens\""));
        assert!(json.contains("RETAIL"));
    }

    #[test]
    fn test_minecraft_auth_request_serialization() {
        let request = MinecraftAuthRequest {
            identity_token: "XBL3.0 x=hash;token".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();

        // Check camelCase for identityToken
        assert!(json.contains("\"identityToken\""));
        assert!(json.contains("XBL3.0"));
    }

    #[test]
    fn test_token_expiry_edge_cases() {
        // Exactly 5 minutes (should be expired due to buffer)
        let five_min = Some(Utc::now() + Duration::minutes(5));
        assert!(is_token_expired(&five_min));

        // Just over 5 minutes (should be valid)
        let five_min_plus = Some(Utc::now() + Duration::minutes(6));
        assert!(!is_token_expired(&five_min_plus));

        // Exactly now (should be expired)
        let now = Some(Utc::now());
        assert!(is_token_expired(&now));
    }

    #[test]
    fn test_constants() {
        // Verify critical constants are set correctly
        assert_eq!(MICROSOFT_CLIENT_ID, "00000000402b5328");
        assert_eq!(REDIRECT_URI, "http://localhost:23947/callback");
        assert_eq!(KEYRING_SERVICE, "wowid3-launcher");
        assert_eq!(KEYRING_USER, "minecraft-auth");

        // Verify API endpoints use HTTPS
        assert!(MICROSOFT_AUTH_URL.starts_with("https://"));
        assert!(MICROSOFT_TOKEN_URL.starts_with("https://"));
        assert!(XBOX_LIVE_AUTH_URL.starts_with("https://"));
        assert!(XSTS_AUTH_URL.starts_with("https://"));
        assert!(MINECRAFT_AUTH_URL.starts_with("https://"));
        assert!(MINECRAFT_PROFILE_URL.starts_with("https://"));
    }
}
