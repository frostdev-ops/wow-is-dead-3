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
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration as StdDuration;

use super::logger::{log_auth, log_storage};
use super::encrypted_storage::{save_encrypted_profile, load_encrypted_profile, delete_encrypted_profile};

const KEYRING_SERVICE: &str = "wowid3-launcher";
const KEYRING_USER: &str = "minecraft-auth";

// Microsoft OAuth constants
/// Microsoft Azure AD client ID for Minecraft authentication.
/// Using MultiMC's client ID which is approved for third-party launchers
const MICROSOFT_CLIENT_ID: &str = "499546d9-bbfe-4b9b-a086-eb3d75afb78f";
const MICROSOFT_DEVICE_CODE_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MICROSOFT_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

// Xbox Live & Minecraft API endpoints
const XBOX_LIVE_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_AUTH_URL: &str = "https://api.minecraftservices.com/launcher/login";
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

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceCodeInfo {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
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
    xtoken: String,
    platform: String,
}

#[derive(Debug, Deserialize)]
struct MinecraftAuthResponse {
    access_token: String,
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
}

#[derive(Debug, Deserialize)]
struct MinecraftEntitlement {
    items: Vec<MinecraftItem>,
}

#[derive(Debug, Deserialize)]
struct MinecraftItem {
    name: String,
}

// Structs for parsing official Minecraft launcher's launcher_profiles.json
#[derive(Debug, Deserialize)]
struct LauncherProfiles {
    #[serde(rename = "authenticationDatabase")]
    authentication_database: HashMap<String, AuthAccount>,
    #[serde(rename = "selectedUser")]
    selected_user: Option<SelectedUser>,
}

#[derive(Debug, Deserialize)]
struct SelectedUser {
    account: String,
    profile: String,
}

#[derive(Debug, Deserialize)]
struct AuthAccount {
    #[serde(rename = "accessToken")]
    access_token: String,
    profiles: HashMap<String, ProfileInfo>,
}

#[derive(Debug, Deserialize)]
struct ProfileInfo {
    #[serde(rename = "displayName")]
    display_name: String,
}

/// Authenticate with Xbox Live using Microsoft token
async fn authenticate_with_xbox_live(ms_access_token: &str) -> Result<(String, String)> {
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()?;

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
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()?;

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
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()?;

    let xtoken = format!("XBL3.0 x={};{}", user_hash, xsts_token);
    let request_body = MinecraftAuthRequest {
        xtoken,
        platform: "PC_LAUNCHER".to_string(),
    };

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
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()?;

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
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()?;

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

/// Request a device code from Microsoft
async fn request_device_code() -> Result<DeviceCodeResponse> {
    let http_client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()
        .context("Failed to create HTTP client")?;

    let params = [
        ("client_id", MICROSOFT_CLIENT_ID),
        ("scope", "XboxLive.signin offline_access"),
    ];

    let response = http_client
        .post(MICROSOFT_DEVICE_CODE_URL)
        .form(&params)
        .send()
        .await
        .context("Failed to request device code from Microsoft")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(anyhow!(
            "Device code request failed with status {}: {}",
            status,
            text
        ));
    }

    response
        .json()
        .await
        .context("Failed to parse device code response")
}

/// Poll Microsoft for token after user completes device code authentication
async fn poll_for_token(device_code: String, interval: u64) -> Result<MicrosoftTokenResponse> {
    let http_client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()
        .context("Failed to create HTTP client")?;

    let params = [
        ("client_id", MICROSOFT_CLIENT_ID),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ("device_code", device_code.as_str()),
    ];

    // Poll with the specified interval
    loop {
        tokio::time::sleep(StdDuration::from_secs(interval)).await;

        let response = http_client
            .post(MICROSOFT_TOKEN_URL)
            .form(&params)
            .send()
            .await
            .context("Failed to poll for token")?;

        if response.status().is_success() {
            let token_response: MicrosoftTokenResponse = response
                .json()
                .await
                .context("Failed to parse token response")?;
            return Ok(token_response);
        }

        // Check for specific errors
        let error_text = response.text().await.unwrap_or_default();

        if error_text.contains("authorization_pending") {
            // User hasn't completed auth yet, continue polling
            println!("Waiting for user to complete authentication...");
            continue;
        } else if error_text.contains("authorization_declined") {
            return Err(anyhow!("User declined the authentication request"));
        } else if error_text.contains("expired_token") {
            return Err(anyhow!("Device code expired. Please try again."));
        } else {
            return Err(anyhow!("Authentication failed: {}", error_text));
        }
    }
}

/// Get device code info for user to complete authentication
pub async fn get_device_code() -> Result<DeviceCodeInfo> {
    let device_code_response = request_device_code().await?;

    Ok(DeviceCodeInfo {
        device_code: device_code_response.device_code,
        user_code: device_code_response.user_code,
        verification_uri: device_code_response.verification_uri,
        expires_in: device_code_response.expires_in,
        interval: device_code_response.interval,
    })
}

/// Complete authentication after user has entered device code
pub async fn complete_device_code_auth(device_code: String, interval: u64) -> Result<MinecraftProfile> {
    // Poll for Microsoft token
    let ms_token = poll_for_token(device_code, interval).await?;
    println!("Obtained Microsoft access token via device code");

    // Continue with Xbox Live → XSTS → Minecraft flow (same as before)
    let (xbox_token, _) = authenticate_with_xbox_live(&ms_token.access_token).await?;
    println!("Authenticated with Xbox Live");

    let (xsts_token, user_hash) = get_xsts_token(&xbox_token).await?;
    println!("Obtained XSTS token");

    let mc_access_token = authenticate_minecraft_token(&xsts_token, &user_hash).await?;
    println!("Authenticated with Minecraft");

    let owns_minecraft = check_minecraft_ownership(&mc_access_token).await?;
    if !owns_minecraft {
        return Err(anyhow!("This Microsoft account does not own Minecraft Java Edition"));
    }
    println!("Verified Minecraft ownership");

    let profile_response = get_minecraft_profile(&mc_access_token).await?;
    println!("Fetched player profile: {}", profile_response.name);

    let expires_at = Utc::now() + Duration::seconds(ms_token.expires_in as i64);

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

    save_user_profile(&profile)?;
    println!("Saved profile to secure storage");

    Ok(profile)
}

/// Get current authenticated user from keyring
pub fn get_current_user() -> Result<Option<MinecraftProfile>> {
    log_auth("USER_LOAD", "Attempting to load user from primary storage (keyring)");

    // Try keyring first
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    match entry.get_password() {
        Ok(json) => {
            match serde_json::from_str::<MinecraftProfile>(&json) {
                Ok(profile) => {
                    log_storage("LOAD", "keyring", true, &format!("User loaded: {}", profile.username));
                    return Ok(Some(profile));
                }
                Err(e) => {
                    log_storage("LOAD", "keyring", false, &format!("Failed to parse: {}", e));
                }
            }
        }
        Err(keyring::Error::NoEntry) => {
            log_storage("LOAD", "keyring", true, "No entry found (normal - user not logged in)");
            // This is normal - user just isn't logged in yet
        }
        Err(e) => {
            log_storage("LOAD", "keyring", false, &format!("Keyring error: {}", e));
            // Keyring failed, try encrypted file as fallback
        }
    }

    // Fallback to encrypted file if keyring failed or had no entry
    log_auth("USER_LOAD", "Attempting fallback: loading from encrypted file");
    match load_encrypted_profile()? {
        Some(profile) => {
            log_storage("LOAD", "encrypted_file", true, &format!("User loaded from fallback: {}", profile.username));

            // Try to restore to keyring for next time
            if let Err(e) = {
                let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
                let json = serde_json::to_string(&profile)?;
                entry.set_password(&json)
            } {
                log_storage("RESTORE", "keyring", false, &format!("Failed to restore: {}", e));
                // This is not fatal - we got the profile from encrypted file
            } else {
                log_storage("RESTORE", "keyring", true, "Profile restored to keyring from encrypted file");
            }

            Ok(Some(profile))
        }
        None => {
            log_storage("LOAD", "encrypted_file", true, "No profile found (user not logged in)");
            Ok(None)
        }
    }
}

/// Save user profile to both keyring (primary) and encrypted file (fallback)
pub fn save_user_profile(profile: &MinecraftProfile) -> Result<()> {
    log_auth("PROFILE_SAVE", "Attempting to save profile to primary storage (keyring)");

    // Try keyring first
    let keyring_result = {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        let json = serde_json::to_string(profile)?;
        match entry.set_password(&json) {
            Ok(_) => {
                log_storage("SAVE", "keyring", true, "Profile saved successfully");
                Ok(())
            }
            Err(e) => {
                log_storage("SAVE", "keyring", false, &format!("Failed: {}", e));
                Err(e)
            }
        }
    };

    // Always save to encrypted file as backup (or primary if keyring fails)
    let encrypted_result = match save_encrypted_profile(profile) {
        Ok(_) => {
            log_storage("SAVE", "encrypted_file", true, "Profile saved as backup");
            Ok(())
        }
        Err(e) => {
            log_storage("SAVE", "encrypted_file", false, &format!("Failed: {}", e));
            Err(e)
        }
    };

    // Success if either storage method succeeds
    match (keyring_result, encrypted_result) {
        (Ok(_), _) | (_, Ok(_)) => {
            log_auth("PROFILE_SAVE", "✓ Profile saved (at least one storage succeeded)");
            Ok(())
        }
        (Err(k_err), Err(e_err)) => {
            log_auth("PROFILE_SAVE", &format!("✗ All storage methods failed - keyring: {}, encrypted: {}", k_err, e_err));
            Err(anyhow!("Failed to save profile to both storage backends: keyring={}, encrypted={}", k_err, e_err))
        }
    }
}

/// Logout and clear stored credentials from both storage backends
pub fn logout() -> Result<()> {
    log_auth("LOGOUT", "Attempting to clear credentials from all storage backends");

    // Clear keyring
    let keyring_result = {
        match Entry::new(KEYRING_SERVICE, KEYRING_USER) {
            Ok(entry) => match entry.delete_credential() {
                Ok(_) => {
                    log_storage("DELETE", "keyring", true, "Credentials cleared from keyring");
                    Ok(())
                }
                Err(e) => {
                    log_storage("DELETE", "keyring", false, &format!("Failed: {}", e));
                    Err(e)
                }
            },
            Err(e) => {
                log_storage("DELETE", "keyring", false, &format!("Failed to create entry: {}", e));
                Err(e)
            }
        }
    };

    // Clear encrypted file
    let encrypted_result = match delete_encrypted_profile() {
        Ok(_) => {
            log_storage("DELETE", "encrypted_file", true, "Credentials cleared from encrypted file");
            Ok(())
        }
        Err(e) => {
            log_storage("DELETE", "encrypted_file", false, &format!("Failed: {}", e));
            Err(e)
        }
    };

    // Success if either storage method succeeds
    match (keyring_result, encrypted_result) {
        (Ok(_), _) | (_, Ok(_)) => {
            log_auth("LOGOUT", "✓ Credentials cleared (at least one storage succeeded)");
            Ok(())
        }
        (Err(k_err), Err(e_err)) => {
            log_auth("LOGOUT", &format!("✗ All logout operations failed - keyring: {}, encrypted: {}", k_err, e_err));
            Err(anyhow!("Failed to logout from both storage backends: keyring={}, encrypted={}", k_err, e_err))
        }
    }
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

    // Request new token using refresh token with timeout
    let http_client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(30))
        .build()
        .context("Failed to create HTTP client")?;

    let params = [
        ("client_id", MICROSOFT_CLIENT_ID),
        ("refresh_token", &refresh_token),
        ("grant_type", "refresh_token"),
    ];

    let response = http_client
        .post(MICROSOFT_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .context("Failed to send refresh token request to Microsoft")?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(anyhow!(
            "Token refresh failed with status {}: {}",
            status,
            text
        ));
    }

    let ms_token: MicrosoftTokenResponse = response
        .json()
        .await
        .context("Failed to parse Microsoft token response")?;

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

/// Get the Minecraft directory path based on the current OS
fn get_minecraft_dir() -> Result<PathBuf> {
    let minecraft_dir = if cfg!(target_os = "windows") {
        let appdata = std::env::var("APPDATA")
            .context("APPDATA environment variable not set")?;
        PathBuf::from(appdata).join(".minecraft")
    } else if cfg!(target_os = "macos") {
        let home = std::env::var("HOME")
            .context("HOME environment variable not set")?;
        PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("minecraft")
    } else {
        // Linux
        let home = std::env::var("HOME")
            .context("HOME environment variable not set")?;
        PathBuf::from(home).join(".minecraft")
    };

    Ok(minecraft_dir)
}

/// Read and parse the official Minecraft launcher's launcher_profiles.json
fn read_launcher_profiles() -> Result<LauncherProfiles> {
    let minecraft_dir = get_minecraft_dir()?;
    let profiles_path = minecraft_dir.join("launcher_profiles.json");

    println!("Looking for official launcher at: {}", profiles_path.display());

    if !profiles_path.exists() {
        return Err(anyhow!(
            "Official Minecraft launcher profiles not found at {}. \
            Please install and log in to the official Minecraft launcher first.",
            profiles_path.display()
        ));
    }

    let contents = std::fs::read_to_string(&profiles_path)
        .context("Failed to read launcher_profiles.json")?;

    let profiles: LauncherProfiles = serde_json::from_str(&contents)
        .context("Failed to parse launcher_profiles.json. The file may be corrupted.")?;

    Ok(profiles)
}

/// Authenticate using credentials from the official Minecraft launcher
pub async fn authenticate_from_official_launcher() -> Result<MinecraftProfile> {
    println!("Attempting to authenticate using official Minecraft launcher credentials...");

    let profiles = read_launcher_profiles()?;

    // Get the selected user account
    let selected = profiles
        .selected_user
        .ok_or_else(|| anyhow!("No user selected in official Minecraft launcher. Please log in to the official launcher first."))?;

    println!("Found selected account: {}", selected.account);

    let account = profiles
        .authentication_database
        .get(&selected.account)
        .ok_or_else(|| anyhow!("Selected account not found in authentication database"))?;

    let profile_info = account
        .profiles
        .get(&selected.profile)
        .ok_or_else(|| anyhow!("Selected profile not found"))?;

    println!("Found profile: {}", profile_info.display_name);

    // Create MinecraftProfile from official launcher data
    let profile = MinecraftProfile {
        uuid: selected.profile.clone(),
        username: profile_info.display_name.clone(),
        access_token: account.access_token.clone(),
        skin_url: None,
        refresh_token: None,
        expires_at: None,
    };

    // Store in keyring for persistence
    save_user_profile(&profile)
        .context("Failed to store credentials in secure storage")?;

    println!(
        "Successfully authenticated as {} using official launcher credentials",
        profile.username
    );

    Ok(profile)
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
            xtoken: "XBL3.0 x=hash;token".to_string(),
            platform: "PC_LAUNCHER".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();

        // Check field names
        assert!(json.contains("\"xtoken\""));
        assert!(json.contains("\"platform\""));
        assert!(json.contains("XBL3.0"));
        assert!(json.contains("PC_LAUNCHER"));
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
        // Verify critical constants are set correctly (MultiMC's approved client ID)
        assert_eq!(MICROSOFT_CLIENT_ID, "499546d9-bbfe-4b9b-a086-eb3d75afb78f");
        assert_eq!(KEYRING_SERVICE, "wowid3-launcher");
        assert_eq!(KEYRING_USER, "minecraft-auth");

        // Verify API endpoints use HTTPS
        assert!(MICROSOFT_TOKEN_URL.starts_with("https://"));
        assert!(MICROSOFT_DEVICE_CODE_URL.starts_with("https://"));
        assert!(XBOX_LIVE_AUTH_URL.starts_with("https://"));
        assert!(XSTS_AUTH_URL.starts_with("https://"));
        assert!(MINECRAFT_AUTH_URL.starts_with("https://"));
        assert!(MINECRAFT_PROFILE_URL.starts_with("https://"));
    }
}
