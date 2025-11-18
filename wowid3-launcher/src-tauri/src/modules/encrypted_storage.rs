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

const STORAGE_DIR_NAME: &str = "wowid3-launcher";
const STORAGE_FILE_NAME: &str = "session.enc";

fn get_storage_dir() -> Result<PathBuf> {
    if let Some(data_dir) = dirs::data_local_dir() {
        let storage_dir = data_dir.join(STORAGE_DIR_NAME);
        fs::create_dir_all(&storage_dir)?;
        Ok(storage_dir)
    } else {
        Err(anyhow!("Could not determine data directory"))
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_and_load_encrypted_profile() {
        let profile = MinecraftProfile {
            uuid: "test-uuid".to_string(),
            username: "testuser".to_string(),
            access_token: "test-token".to_string(),
            skin_url: Some("https://example.com/skin.png".to_string()),
            refresh_token: Some("test-refresh".to_string()),
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
