use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::Rng;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use sha2::Digest;

use super::auth::MinecraftProfile;
use super::logger::log_storage;

const STORAGE_FILE_NAME: &str = "session.enc";

fn get_storage_dir() -> Result<PathBuf> {
    // Use persistent data directory to avoid AppImage temp path issues
    let storage_dir = super::paths::get_persistent_data_dir()?;
    fs::create_dir_all(&storage_dir)?;
    Ok(storage_dir)
}

fn get_storage_path() -> Result<PathBuf> {
    let storage_dir = get_storage_dir()?;
    Ok(storage_dir.join(STORAGE_FILE_NAME))
}

/// Generate a machine-specific encryption key based on available system identifiers
fn generate_machine_key() -> Result<[u8; 32]> {
    // Use a combination of factors to create a machine-specific key
    // In a real app, you might use device UUID, MAC address, etc.
    // For now, we'll use a hash of hostname + username as a simple approach

    let hostname = hostname::get()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let username = std::env::var("USER").unwrap_or_else(|_| "unknown".to_string());

    let key_material = format!("{}:{}", hostname, username);
    let hash = sha2::Sha256::digest(key_material.as_bytes());

    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    Ok(key)
}

pub fn save_encrypted_profile(profile: &MinecraftProfile) -> Result<()> {
    log_storage("SAVE", "encrypted_file", true, "Attempting to save encrypted profile");

    // Generate key and nonce
    let key = generate_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());

    let mut rng = rand::thread_rng();
    let nonce_bytes: [u8; 12] = rng.gen();
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Serialize profile to JSON
    let profile_json = serde_json::to_string(profile)?;

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, Payload::from(profile_json.as_bytes()))
        .map_err(|e| anyhow!("Encryption failed: {}", e))?;

    // Create envelope: nonce + ciphertext
    let envelope = json!({
        "v": 1,
        "nonce": STANDARD.encode(&nonce_bytes),
        "ciphertext": STANDARD.encode(&ciphertext),
    });

    // Write to file
    let storage_path = get_storage_path()?;
    let envelope_json = serde_json::to_string(&envelope)?;
    fs::write(&storage_path, envelope_json)?;

    log_storage("SAVE", "encrypted_file", true, "Profile encrypted and saved");
    Ok(())
}

pub fn load_encrypted_profile() -> Result<Option<MinecraftProfile>> {
    let storage_path = get_storage_path()?;

    // Check if file exists
    if !storage_path.exists() {
        log_storage("LOAD", "encrypted_file", true, "No encrypted file found (normal)");
        return Ok(None);
    }

    log_storage("LOAD", "encrypted_file", true, "Reading encrypted file");

    // Read and parse envelope
    let envelope_json = fs::read_to_string(&storage_path)?;
    let envelope: Value = serde_json::from_str(&envelope_json)?;

    // Extract components
    let nonce_b64 = envelope["nonce"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid envelope: missing nonce"))?;
    let ciphertext_b64 = envelope["ciphertext"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid envelope: missing ciphertext"))?;

    let nonce_bytes = STANDARD
        .decode(nonce_b64)
        .map_err(|e| anyhow!("Invalid nonce encoding: {}", e))?;
    let ciphertext = STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| anyhow!("Invalid ciphertext encoding: {}", e))?;

    if nonce_bytes.len() != 12 {
        return Err(anyhow!("Invalid nonce length"));
    }

    // Decrypt
    let key = generate_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, Payload::from(ciphertext.as_slice()))
        .map_err(|e| anyhow!("Decryption failed: {}", e))?;

    // Deserialize profile
    let profile_json = String::from_utf8(plaintext)?;
    let profile: MinecraftProfile = serde_json::from_str(&profile_json)?;

    log_storage("LOAD", "encrypted_file", true, "Profile decrypted successfully");
    Ok(Some(profile))
}

pub fn delete_encrypted_profile() -> Result<()> {
    let storage_path = get_storage_path()?;
    if storage_path.exists() {
        fs::remove_file(&storage_path)?;
        log_storage("DELETE", "encrypted_file", true, "Encrypted profile deleted");
    }
    Ok(())
}

// Token storage functions (as fallback when keyring fails)
// Tokens are stored in a separate encrypted file for each session_id

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

fn get_tokens_storage_dir() -> Result<PathBuf> {
    let storage_dir = super::paths::get_persistent_data_dir()?;
    let tokens_dir = storage_dir.join("tokens");
    fs::create_dir_all(&tokens_dir)?;
    Ok(tokens_dir)
}

fn get_tokens_storage_path(session_id: &str) -> Result<PathBuf> {
    let tokens_dir = get_tokens_storage_dir()?;
    Ok(tokens_dir.join(format!("{}.enc", session_id)))
}

pub fn save_encrypted_tokens(session_id: &str, tokens: &TokenData) -> Result<()> {
    eprintln!("[AUTH] 📁 save_encrypted_tokens() called for session_id: {}", session_id);

    let key = generate_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());

    let mut rng = rand::thread_rng();
    let nonce_bytes: [u8; 12] = rng.gen();
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Serialize tokens to JSON
    let tokens_json = serde_json::to_string(tokens)?;

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, Payload::from(tokens_json.as_bytes()))
        .map_err(|e| anyhow!("Token encryption failed: {}", e))?;

    // Create envelope: nonce + ciphertext
    let envelope = json!({
        "v": 1,
        "nonce": STANDARD.encode(&nonce_bytes),
        "ciphertext": STANDARD.encode(&ciphertext),
    });

    // Write to file
    let storage_path = get_tokens_storage_path(session_id)?;
    let envelope_json = serde_json::to_string(&envelope)?;
    fs::write(&storage_path, envelope_json)?;

    eprintln!("[AUTH]   ✓ Tokens encrypted and saved to: {:?}", storage_path);
    log_storage("SAVE", "encrypted_tokens", true, &format!("Tokens saved for session: {}", session_id));
    Ok(())
}

pub fn load_encrypted_tokens(session_id: &str) -> Result<Option<TokenData>> {
    eprintln!("[AUTH] 📁 load_encrypted_tokens() called for session_id: {}", session_id);

    let storage_path = get_tokens_storage_path(session_id)?;

    // Check if file exists
    if !storage_path.exists() {
        eprintln!("[AUTH]   ℹ️  No encrypted tokens file found for this session");
        log_storage("LOAD", "encrypted_tokens", true, "No tokens file found (normal)");
        return Ok(None);
    }

    log_storage("LOAD", "encrypted_tokens", true, "Reading encrypted tokens file");

    // Read and parse envelope
    let envelope_json = fs::read_to_string(&storage_path)?;
    let envelope: Value = serde_json::from_str(&envelope_json)?;

    // Extract components
    let nonce_b64 = envelope
        .get("nonce")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("Missing nonce in tokens envelope"))?;
    let ciphertext_b64 = envelope
        .get("ciphertext")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("Missing ciphertext in tokens envelope"))?;

    // Decode from base64
    let nonce_bytes = STANDARD.decode(nonce_b64)?;
    let ciphertext = STANDARD.decode(ciphertext_b64)?;

    // Decrypt
    let key = generate_machine_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, Payload::from(ciphertext.as_slice()))
        .map_err(|e| anyhow!("Token decryption failed: {}", e))?;

    // Deserialize tokens
    let tokens_json = String::from_utf8(plaintext)?;
    let tokens: TokenData = serde_json::from_str(&tokens_json)?;

    eprintln!("[AUTH]   ✓ Tokens decrypted successfully");
    log_storage("LOAD", "encrypted_tokens", true, "Tokens decrypted successfully");
    Ok(Some(tokens))
}

pub fn delete_encrypted_tokens(session_id: &str) -> Result<()> {
    let storage_path = get_tokens_storage_path(session_id)?;
    if storage_path.exists() {
        fs::remove_file(&storage_path)?;
        eprintln!("[AUTH]   ✓ Deleted encrypted tokens for session_id: {}", session_id);
        log_storage("DELETE", "encrypted_tokens", true, &format!("Tokens deleted for session: {}", session_id));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_and_load_encrypted_profile() {
        let profile = MinecraftProfile {
            uuid: "test-uuid".to_string(),
            username: "testuser".to_string(),
            session_id: "test-session-id".to_string(),
            skin_url: Some("https://example.com/skin.png".to_string()),
            expires_at: None,
        };

        // Save
        let save_result = save_encrypted_profile(&profile);
        assert!(save_result.is_ok());

        // Load
        let load_result = load_encrypted_profile();
        assert!(load_result.is_ok());

        if let Ok(Some(loaded)) = load_result {
            assert_eq!(loaded.username, "testuser");
            assert_eq!(loaded.uuid, "test-uuid");
        } else {
            panic!("Failed to load profile");
        }

        // Cleanup
        let _ = delete_encrypted_profile();
    }
}
