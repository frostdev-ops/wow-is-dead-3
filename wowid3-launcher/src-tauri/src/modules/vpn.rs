// This module is Windows-only because it uses Windows-specific APIs:
// - sc.exe (Service Control Manager) for WireGuard tunnel status
// - PROGRAMDATA environment variable for config storage
// - WireGuardNT service naming convention
//
// Cross-platform support would require:
// - Linux: wg show command, /etc/wireguard/ paths
// - macOS: different WireGuard installation paths and service management
#![cfg(target_os = "windows")]

use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use rand::rngs::OsRng;
use std::path::{Path, PathBuf};
use std::process::Command;
use x25519_dalek::{PublicKey, StaticSecret};

pub struct VpnManager {
    config_dir: PathBuf,
}

impl VpnManager {
    pub fn new() -> Result<Self> {
        let config_dir = Self::get_config_dir()?;
        std::fs::create_dir_all(&config_dir)?;
        Ok(Self { config_dir })
    }

    fn get_config_dir() -> Result<PathBuf> {
        let program_data =
            std::env::var("PROGRAMDATA").unwrap_or_else(|_| "C:\\ProgramData".to_string());
        Ok(Path::new(&program_data).join("wowid3-launcher").join("vpn"))
    }

    pub fn generate_keypair() -> Result<(String, String)> {
        let private_key = StaticSecret::random_from_rng(OsRng);
        let public_key = PublicKey::from(&private_key);

        let private_b64 = general_purpose::STANDARD.encode(private_key.to_bytes());
        let public_b64 = general_purpose::STANDARD.encode(public_key.as_bytes());

        Ok((private_b64, public_b64))
    }

    pub fn has_keypair(&self) -> bool {
        self.config_dir.join("private.key").exists()
    }

    pub fn store_keypair(&self, private_key: &str, public_key: &str) -> Result<()> {
        std::fs::write(self.config_dir.join("private.key"), private_key)?;
        std::fs::write(self.config_dir.join("public.key"), public_key)?;
        Ok(())
    }

    pub fn load_keypair(&self) -> Result<(String, String)> {
        let private = std::fs::read_to_string(self.config_dir.join("private.key"))?;
        let public = std::fs::read_to_string(self.config_dir.join("public.key"))?;
        Ok((private, public))
    }

    pub fn write_config(&self, config_content: &str) -> Result<()> {
        let config_path = self.config_dir.join("wowid3.conf");
        std::fs::write(config_path, config_content)?;
        Ok(())
    }

    pub fn get_config_path(&self) -> Result<PathBuf> {
        Ok(self.config_dir.join("wowid3.conf"))
    }

    pub fn tunnel_exists(&self) -> bool {
        // Check if WireGuard service exists
        let output = Command::new("sc")
            .args(&["query", "WireGuardTunnel$wowid3"])
            .output();

        output.map(|o| o.status.success()).unwrap_or(false)
    }

    pub fn is_tunnel_running(&self) -> bool {
        let output = Command::new("sc")
            .args(&["query", "WireGuardTunnel$wowid3"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.contains("RUNNING")
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // Helper to create a test VpnManager with a temporary directory
    fn create_test_manager() -> (VpnManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let manager = VpnManager {
            config_dir: temp_dir.path().to_path_buf(),
        };
        std::fs::create_dir_all(&manager.config_dir).unwrap();
        (manager, temp_dir)
    }

    #[test]
    fn test_generate_keypair_creates_valid_base64() {
        let (private, public) = VpnManager::generate_keypair().unwrap();

        // Verify base64 encoding
        assert!(general_purpose::STANDARD.decode(&private).is_ok());
        assert!(general_purpose::STANDARD.decode(&public).is_ok());

        // Verify lengths (32 bytes each = 44 chars in base64)
        assert_eq!(
            general_purpose::STANDARD.decode(&private).unwrap().len(),
            32
        );
        assert_eq!(general_purpose::STANDARD.decode(&public).unwrap().len(), 32);
    }

    #[test]
    fn test_keypair_is_different_each_time() {
        let (private1, public1) = VpnManager::generate_keypair().unwrap();
        let (private2, public2) = VpnManager::generate_keypair().unwrap();

        assert_ne!(private1, private2);
        assert_ne!(public1, public2);
    }

    #[test]
    fn test_vpn_manager_creation_succeeds() {
        let (manager, _temp_dir) = create_test_manager();

        // Verify config directory exists
        assert!(manager.config_dir.exists());
        assert!(manager.config_dir.is_dir());
    }

    #[test]
    fn test_manager_initialization_is_idempotent() {
        let (manager, _temp_dir) = create_test_manager();

        // Create directory structure multiple times
        std::fs::create_dir_all(&manager.config_dir).unwrap();
        std::fs::create_dir_all(&manager.config_dir).unwrap();

        // Should still be valid
        assert!(manager.config_dir.exists());
    }

    #[test]
    fn test_keypair_generation_length_is_correct() {
        let (private, public) = VpnManager::generate_keypair().unwrap();

        // Decode and verify exact length (x25519 keys are 32 bytes)
        let private_bytes = general_purpose::STANDARD.decode(&private).unwrap();
        let public_bytes = general_purpose::STANDARD.decode(&public).unwrap();

        assert_eq!(
            private_bytes.len(),
            32,
            "Private key should be exactly 32 bytes"
        );
        assert_eq!(
            public_bytes.len(),
            32,
            "Public key should be exactly 32 bytes"
        );
    }

    #[test]
    fn test_keypair_storage_and_retrieval() {
        let (manager, _temp_dir) = create_test_manager();

        // Generate and store keypair
        let (private, public) = VpnManager::generate_keypair().unwrap();
        manager.store_keypair(&private, &public).unwrap();

        // Verify has_keypair returns true
        assert!(manager.has_keypair());

        // Load and verify
        let (loaded_private, loaded_public) = manager.load_keypair().unwrap();
        assert_eq!(loaded_private, private);
        assert_eq!(loaded_public, public);
    }

    #[test]
    fn test_has_keypair_returns_false_when_no_keypair() {
        let (manager, _temp_dir) = create_test_manager();

        // Should return false when no keypair is stored
        assert!(!manager.has_keypair());
    }

    #[test]
    fn test_keypair_overwrite_works() {
        let (manager, _temp_dir) = create_test_manager();

        // Store first keypair
        let (private1, public1) = VpnManager::generate_keypair().unwrap();
        manager.store_keypair(&private1, &public1).unwrap();

        // Store second keypair (overwrite)
        let (private2, public2) = VpnManager::generate_keypair().unwrap();
        manager.store_keypair(&private2, &public2).unwrap();

        // Load and verify it's the second keypair
        let (loaded_private, loaded_public) = manager.load_keypair().unwrap();
        assert_eq!(loaded_private, private2);
        assert_eq!(loaded_public, public2);
        assert_ne!(loaded_private, private1);
        assert_ne!(loaded_public, public1);
    }

    #[test]
    fn test_config_file_writing() {
        let (manager, _temp_dir) = create_test_manager();

        let config_content = "[Interface]\nPrivateKey = test_key\nAddress = 10.8.0.2/24\n\n[Peer]\nPublicKey = server_key\nEndpoint = example.com:51820";

        // Write config
        manager.write_config(config_content).unwrap();

        // Verify file exists
        let config_path = manager.get_config_path().unwrap();
        assert!(config_path.exists());

        // Verify content matches
        let written_content = std::fs::read_to_string(config_path).unwrap();
        assert_eq!(written_content, config_content);
    }

    #[test]
    fn test_config_overwrite_works() {
        let (manager, _temp_dir) = create_test_manager();

        // Write first config
        let config1 = "[Interface]\nAddress = 10.8.0.2/24";
        manager.write_config(config1).unwrap();

        // Write second config (overwrite)
        let config2 = "[Interface]\nAddress = 10.8.0.3/24";
        manager.write_config(config2).unwrap();

        // Verify it's the second config
        let config_path = manager.get_config_path().unwrap();
        let written_content = std::fs::read_to_string(config_path).unwrap();
        assert_eq!(written_content, config2);
    }

    #[test]
    fn test_get_config_path_returns_correct_path() {
        let (manager, _temp_dir) = create_test_manager();

        let config_path = manager.get_config_path().unwrap();
        assert_eq!(config_path.file_name().unwrap(), "wowid3.conf");
        assert_eq!(config_path.parent().unwrap(), manager.config_dir);
    }
}
