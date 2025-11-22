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
use base64::{Engine as _, engine::general_purpose};
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
        let program_data = std::env::var("PROGRAMDATA")
            .unwrap_or_else(|_| "C:\\ProgramData".to_string());
        Ok(Path::new(&program_data)
            .join("wowid3-launcher")
            .join("vpn"))
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

    #[test]
    fn test_generate_keypair_creates_valid_base64() {
        let (private, public) = VpnManager::generate_keypair().unwrap();

        // Verify base64 encoding
        assert!(general_purpose::STANDARD.decode(&private).is_ok());
        assert!(general_purpose::STANDARD.decode(&public).is_ok());

        // Verify lengths (32 bytes each = 44 chars in base64)
        assert_eq!(general_purpose::STANDARD.decode(&private).unwrap().len(), 32);
        assert_eq!(general_purpose::STANDARD.decode(&public).unwrap().len(), 32);
    }

    #[test]
    fn test_keypair_is_different_each_time() {
        let (private1, public1) = VpnManager::generate_keypair().unwrap();
        let (private2, public2) = VpnManager::generate_keypair().unwrap();

        assert_ne!(private1, private2);
        assert_ne!(public1, public2);
    }
}
