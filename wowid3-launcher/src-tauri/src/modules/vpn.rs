// Cross-platform VPN management module
// - Windows: Uses sc.exe for service control, PROGRAMDATA for storage
// - Linux: Uses wg-quick for tunnel control, ~/.config for storage
//
// Both platforms use WireGuard with identical config format

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

    /// Check if WireGuard is installed on the system
    #[cfg(target_os = "windows")]
    pub fn is_wireguard_installed() -> bool {
        // Strategy 1: Check if wg.exe is in PATH
        let in_path = Command::new("where")
            .arg("wg.exe")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if in_path {
            eprintln!("[VPN] WireGuard found in PATH");
            return true;
        }

        // Strategy 2: Check common installation directories
        let common_paths = vec![
            r"C:\Program Files\WireGuard\wg.exe",
            r"C:\Program Files (x86)\WireGuard\wg.exe",
        ];

        for path in common_paths {
            if std::path::Path::new(path).exists() {
                eprintln!("[VPN] WireGuard found at: {}", path);
                return true;
            }
        }

        eprintln!("[VPN] WireGuard not found in PATH or common install locations");
        false
    }

    #[cfg(target_os = "linux")]
    pub fn is_wireguard_installed() -> bool {
        // Check if wg-quick is available
        Command::new("which")
            .arg("wg-quick")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    pub fn is_wireguard_installed() -> bool {
        false
    }

    #[cfg(target_os = "windows")]
    fn get_config_dir() -> Result<PathBuf> {
        let program_data =
            std::env::var("PROGRAMDATA").unwrap_or_else(|_| "C:\\ProgramData".to_string());
        Ok(Path::new(&program_data).join("wowid3-launcher").join("vpn"))
    }

    #[cfg(target_os = "linux")]
    fn get_config_dir() -> Result<PathBuf> {
        let home = std::env::var("HOME")
            .map_err(|_| anyhow::anyhow!("HOME environment variable not set"))?;
        Ok(Path::new(&home).join(".config").join("wowid3-launcher").join("vpn"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    fn get_config_dir() -> Result<PathBuf> {
        Err(anyhow::anyhow!("Unsupported platform"))
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
        std::fs::write(&config_path, config_content)?;

        // Set secure permissions (600 - owner read/write only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = std::fs::Permissions::from_mode(0o600);
            std::fs::set_permissions(&config_path, permissions)?;
        }

        Ok(())
    }

    pub fn get_config_path(&self) -> Result<PathBuf> {
        Ok(self.config_dir.join("wowid3.conf"))
    }

    #[cfg(target_os = "windows")]
    pub fn tunnel_exists(&self) -> bool {
        // Check if WireGuard service exists
        let output = Command::new("sc")
            .args(&["query", "WireGuardTunnel$wowid3"])
            .output();

        output.map(|o| o.status.success()).unwrap_or(false)
    }

    #[cfg(target_os = "linux")]
    pub fn tunnel_exists(&self) -> bool {
        // Check if wg-quick is installed and config exists
        let wg_quick_exists = Command::new("which")
            .arg("wg-quick")
            .status()
            .map(|s| s.success())
            .unwrap_or(false);

        let config_exists = self.config_dir.join("wowid3.conf").exists();

        wg_quick_exists && config_exists
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    pub fn tunnel_exists(&self) -> bool {
        false
    }

    #[cfg(target_os = "windows")]
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

    #[cfg(target_os = "linux")]
    pub fn is_tunnel_running(&self) -> bool {
        // Check if wowid3 interface is active
        let output = Command::new("wg")
            .args(&["show", "wowid3"])
            .output();

        output.map(|o| o.status.success()).unwrap_or(false)
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    pub fn is_tunnel_running(&self) -> bool {
        false
    }

    #[cfg(target_os = "windows")]
    pub fn start_tunnel(&self) -> Result<()> {
        let output = Command::new("net")
            .args(&["start", "WireGuardTunnel$wowid3"])
            .output()?;

        if output.status.success() {
            Ok(())
        } else {
            Err(anyhow::anyhow!("Failed to start VPN tunnel"))
        }
    }

    #[cfg(target_os = "linux")]
    pub fn start_tunnel(&self) -> Result<()> {
        let config_path = self.get_config_path()?;

        // Verify config exists
        if !config_path.exists() {
            return Err(anyhow::anyhow!(
                "VPN config not found at: {}\nPlease complete VPN setup first.",
                config_path.display()
            ));
        }

        // Try to load WireGuard kernel module if not already loaded
        eprintln!("[VPN] Checking WireGuard kernel module...");
        let modprobe_result = Command::new("sudo")
            .args(&["modprobe", "wireguard"])
            .output();

        match modprobe_result {
            Ok(out) if !out.status.success() => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                eprintln!("[VPN] Warning: Could not load wireguard module: {}", stderr);
                eprintln!("[VPN] Continuing anyway (module might already be built-in)...");
            }
            Ok(_) => eprintln!("[VPN] WireGuard module loaded successfully"),
            Err(e) => eprintln!("[VPN] Warning: Could not run modprobe: {}", e),
        }

        // Use full path to wg-quick
        let wg_quick_path = which::which("wg-quick")
            .unwrap_or_else(|_| std::path::PathBuf::from("/usr/bin/wg-quick"));

        eprintln!("[VPN] Starting tunnel with config: {}", config_path.display());
        eprintln!("[VPN] Using wg-quick at: {}", wg_quick_path.display());

        // Try pkexec first (graphical sudo prompt)
        let output = Command::new("pkexec")
            .args(&[
                wg_quick_path.to_str().unwrap(),
                "up",
                config_path.to_str().unwrap()
            ])
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);

                eprintln!("[VPN] Exit code: {:?}", out.status.code());
                eprintln!("[VPN] Stdout: {}", stdout);
                eprintln!("[VPN] Stderr: {}", stderr);

                if out.status.success() {
                    Ok(())
                } else {
                    // Check if pkexec was denied or failed
                    if stderr.contains("dismissed") || stderr.contains("Not authorized") || out.status.code() == Some(127) {
                        Err(anyhow::anyhow!(
                            "PolicyKit authorization required. To fix this, configure passwordless sudo for wg-quick:\n\n\
                            1. Run this command:\n   sudo visudo -f /etc/sudoers.d/wowid3-vpn\n\n\
                            2. Add this line:\n   {} ALL=(ALL) NOPASSWD: {}\n\n\
                            3. Save and exit (Ctrl+X, then Y, then Enter)\n\n\
                            4. Try enabling VPN again\n\n\
                            This allows the launcher to manage the VPN without password prompts.",
                            whoami::username(),
                            wg_quick_path.display()
                        ))
                    } else if stderr.contains("already exists") || stdout.contains("already exists") {
                        // Interface already up, that's fine
                        Ok(())
                    } else if stderr.contains("Protocol not supported") || stderr.contains("Unknown device type") {
                        // WireGuard kernel module not available
                        Err(anyhow::anyhow!(
                            "WireGuard kernel module not available.\n\n\
                            On Arch Linux, try:\n\
                            1. sudo modprobe wireguard\n\
                            2. If that fails, install the module:\n   sudo pacman -S wireguard-dkms\n\n\
                            On other distros:\n\
                            - Ubuntu/Debian: sudo apt install wireguard-dkms\n\
                            - Fedora: sudo dnf install wireguard-tools\n\n\
                            Alternatively, update your kernel to 5.6+ (WireGuard is built-in).\n\n\
                            Original error: {}",
                            stderr
                        ))
                    } else {
                        Err(anyhow::anyhow!(
                            "Failed to start VPN tunnel (exit code: {:?})\nStdout: {}\nStderr: {}",
                            out.status.code(),
                            stdout,
                            stderr
                        ))
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // pkexec not found, show instructions for sudo setup
                Err(anyhow::anyhow!(
                    "pkexec not found. Please configure passwordless sudo for wg-quick:\n\n\
                    sudo visudo -f /etc/sudoers.d/wowid3-vpn\n\
                    Add: {} ALL=(ALL) NOPASSWD: {}\n\n\
                    Then try again.",
                    whoami::username(),
                    wg_quick_path.display()
                ))
            }
            Err(e) => Err(anyhow::anyhow!("Failed to execute pkexec: {}", e))
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    pub fn start_tunnel(&self) -> Result<()> {
        Err(anyhow::anyhow!("Unsupported platform"))
    }

    #[cfg(target_os = "windows")]
    pub fn stop_tunnel(&self) -> Result<()> {
        let output = Command::new("net")
            .args(&["stop", "WireGuardTunnel$wowid3"])
            .output()?;

        if output.status.success() {
            Ok(())
        } else {
            Err(anyhow::anyhow!("Failed to stop VPN tunnel"))
        }
    }

    #[cfg(target_os = "linux")]
    pub fn stop_tunnel(&self) -> Result<()> {
        // Try pkexec first (graphical sudo prompt)
        let output = Command::new("pkexec")
            .args(&["wg-quick", "down", "wowid3"])
            .output();

        match output {
            Ok(out) if out.status.success() => Ok(()),
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);

                // If interface doesn't exist, that's fine (already stopped)
                if stderr.contains("does not exist") || stderr.contains("Cannot find device") {
                    return Ok(());
                }

                // Check if pkexec was denied
                if stderr.contains("dismissed") || stderr.contains("Not authorized") {
                    Err(anyhow::anyhow!(
                        "Authorization required to stop VPN tunnel. \
                        Please grant permission when prompted."
                    ))
                } else {
                    Err(anyhow::anyhow!("Failed to stop VPN tunnel: {}", stderr))
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // pkexec not found, try without sudo (might already be down)
                Ok(())
            }
            Err(e) => Err(anyhow::anyhow!("Failed to execute pkexec: {}", e))
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    pub fn stop_tunnel(&self) -> Result<()> {
        Err(anyhow::anyhow!("Unsupported platform"))
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
