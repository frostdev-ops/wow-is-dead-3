use anyhow::Result;
use keyring::Entry;
use oauth2::{
    AuthorizationCode, AuthUrl, ClientId, CsrfToken, PkceCodeChallenge, PkceCodeVerifier,
    RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

const KEYRING_SERVICE: &str = "wowid3-launcher";
const KEYRING_USER: &str = "minecraft-auth";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftProfile {
    pub uuid: String,
    pub username: String,
    pub access_token: String,
    pub skin_url: Option<String>,
}

/// Microsoft OAuth authentication flow for Minecraft
pub async fn authenticate_minecraft() -> Result<MinecraftProfile> {
    // TODO: Implement Microsoft OAuth flow
    // 1. Start local HTTP server on localhost:23947
    // 2. Open browser to Microsoft OAuth URL
    // 3. Wait for callback with authorization code
    // 4. Exchange code for access token
    // 5. Get Xbox Live token
    // 6. Get XSTS token
    // 7. Get Minecraft token
    // 8. Fetch player profile

    todo!("Implement Microsoft OAuth flow")
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

/// Refresh expired OAuth token
pub async fn refresh_token() -> Result<MinecraftProfile> {
    // TODO: Implement token refresh logic
    todo!("Implement token refresh")
}
