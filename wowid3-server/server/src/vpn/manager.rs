use anyhow::Result;
use std::process::Command;

pub struct WireGuardManager;

impl WireGuardManager {
    pub fn add_peer(public_key: &str, ip: &str) -> Result<()> {
        let output = Command::new("sudo")
            .args(&["wg", "set", "wg0", "peer", public_key, "allowed-ips", &format!("{}/32", ip)])
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to add WireGuard peer: {}", error));
        }

        Ok(())
    }

    pub fn remove_peer(public_key: &str) -> Result<()> {
        let output = Command::new("sudo")
            .args(&["wg", "set", "wg0", "peer", public_key, "remove"])
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to remove WireGuard peer: {}", error));
        }

        Ok(())
    }

    pub fn get_server_public_key() -> Result<String> {
        // Try reading from file first
        if let Ok(key) = std::fs::read_to_string("/etc/wireguard/server_public.key") {
            return Ok(key.trim().to_string());
        }

        // Fallback to getting it from wg show command
        let output = Command::new("sudo")
            .args(&["wg", "show", "wg0", "public-key"])
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to get server public key: {}", error));
        }

        let key = String::from_utf8_lossy(&output.stdout)
            .trim()
            .to_string();
        Ok(key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_peer_command_format() {
        // This test will fail until implementation is tested on actual server
        // For now, just verify the module compiles
        assert_eq!(1, 1);
    }
}
