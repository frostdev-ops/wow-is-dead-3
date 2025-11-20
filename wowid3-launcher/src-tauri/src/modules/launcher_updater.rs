use anyhow::Result;
use serde::Serialize;
use tauri::AppHandle;

#[cfg(target_os = "windows")]
use anyhow::Context;
#[cfg(target_os = "windows")]
use serde::Deserialize;
#[cfg(target_os = "windows")]
use std::time::Duration;
#[cfg(target_os = "windows")]
use sha2::{Digest, Sha256};
#[cfg(target_os = "windows")]
use std::env;
#[cfg(target_os = "windows")]
use std::process::Command;
#[cfg(target_os = "windows")]
use tokio::fs;
#[cfg(target_os = "windows")]
use tokio::io::AsyncWriteExt;
#[cfg(target_os = "windows")]
use futures_util::StreamExt;

#[cfg(target_os = "windows")]
#[cfg(target_os = "windows")]
const LAUNCHER_MANIFEST_URL: &str = "https://wowid-launcher.frostdev.io/api/launcher/latest";

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherManifest {
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
    pub changelog: String,
    pub mandatory: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LauncherUpdateInfo {
    pub available: bool,
    pub version: String,
    pub changelog: String,
    pub mandatory: bool,
    pub download_url: String,
    pub sha256: String,
}

/// Check for launcher updates
pub async fn check_launcher_update(app: &AppHandle) -> Result<LauncherUpdateInfo> {
    // Self-update only supported on Windows
    #[cfg(not(target_os = "windows"))]
    {
        // Platform check logged once - not an error, just informational
        let package_info = app.package_info();
        return Ok(LauncherUpdateInfo {
            available: false,
            version: package_info.version.to_string(),
            changelog: String::new(),
            mandatory: false,
            download_url: String::new(),
            sha256: String::new(),
        });
    }
    
    #[cfg(target_os = "windows")]
    {
        // Get current version
        let package_info = app.package_info();
        let current_version = &package_info.version;
        
        eprintln!("[Launcher Updater] Current launcher version: {}", current_version);
        
        // Fetch manifest
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .context("Failed to create HTTP client")?;

        let response = client
            .get(LAUNCHER_MANIFEST_URL)
            .send()
            .await
            .context("Failed to fetch launcher manifest")?;

        if response.status() == 404 {
            // No update available (or configured)
            eprintln!("[Launcher Updater] No launcher manifest found on server (404)");
            return Ok(LauncherUpdateInfo {
                available: false,
                version: current_version.to_string(),
                changelog: String::new(),
                mandatory: false,
                download_url: String::new(),
                sha256: String::new(),
            });
        }

        let manifest: LauncherManifest = response
            .json()
            .await
            .context("Failed to parse launcher manifest")?;

        eprintln!("[Launcher Updater] Remote launcher version: {}", manifest.version);
        
        // Compare versions
        let update_available = is_newer_version(&manifest.version, &current_version.to_string());
        
        eprintln!("[Launcher Updater] Update available: {} (remote: {}, local: {})", 
            update_available, manifest.version, current_version);

        Ok(LauncherUpdateInfo {
            available: update_available,
            version: manifest.version,
            changelog: manifest.changelog,
            mandatory: manifest.mandatory,
            download_url: manifest.url,
            sha256: manifest.sha256,
        })
    }
}

#[cfg(target_os = "windows")]
fn is_newer_version(remote: &str, local: &str) -> bool {
    // Simple SemVer parsing
    let parse_version = |v: &str| -> Vec<u32> {
        v.split('.')
            .map(|s| s.parse::<u32>().unwrap_or(0))
            .collect()
    };

    let remote_parts = parse_version(remote);
    let local_parts = parse_version(local);

    for (r, l) in remote_parts.iter().zip(local_parts.iter()) {
        if r > l {
            return true;
        }
        if r < l {
            return false;
        }
    }
    
    // If lengths differ (e.g. 1.0 vs 1.0.1), longer is newer if extra parts > 0
    if remote_parts.len() > local_parts.len() {
        return remote_parts.iter().skip(local_parts.len()).any(|&x| x > 0);
    }

    false
}

/// Install launcher update (Windows only logic mostly, but safe to keep generic structure)
#[allow(unused_variables)]
pub async fn install_launcher_update<F>(
    url: String, 
    sha256: String, 
    progress_callback: F
) -> Result<()> 
where
    F: Fn(u64, u64) + Send + Sync + 'static
{
    #[cfg(not(target_os = "windows"))]
    {
        anyhow::bail!("Self-update is only supported on Windows");
    }

    #[cfg(target_os = "windows")]
    {
        let current_exe = env::current_exe().context("Failed to get current executable path")?;
        let exe_dir = current_exe.parent().context("Failed to get executable directory")?;
        
        // Temp file for download
        let temp_exe = exe_dir.join(format!("update_{}.exe", uuid::Uuid::new_v4()));

        // Download file
        eprintln!("[Updater] Downloading update from {}", url);
        let response = reqwest::get(&url).await.context("Failed to download update")?;
        let total_size = response.content_length().unwrap_or(0);
        
        let mut file = fs::File::create(&temp_exe).await.context("Failed to create temp file")?;
        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.context("Error downloading chunk")?;
            file.write_all(&chunk).await.context("Error writing to file")?;
            downloaded += chunk.len() as u64;
            progress_callback(downloaded, total_size);
        }
        
        file.flush().await.context("Failed to flush file")?;
        drop(file); // Close file

        // Verify hash
        let bytes = fs::read(&temp_exe).await.context("Failed to read downloaded file")?;
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let calculated_hash = format!("{:x}", hasher.finalize());

        if calculated_hash != sha256 {
            fs::remove_file(&temp_exe).await.ok();
            anyhow::bail!("Checksum mismatch. Expected {}, got {}", sha256, calculated_hash);
        }

        eprintln!("[Updater] Checksum verified. Applying update...");

        // Rename current exe to .old
        let old_exe = current_exe.with_extension("exe.old");
        if old_exe.exists() {
            fs::remove_file(&old_exe).await.context("Failed to remove existing .old file")?;
        }
        
        fs::rename(&current_exe, &old_exe).await.context("Failed to rename current executable")?;
        
        // Move new exe to current path
        if let Err(e) = fs::rename(&temp_exe, &current_exe).await {
            // Rollback
            fs::rename(&old_exe, &current_exe).await.ok();
            anyhow::bail!("Failed to move new executable: {}", e);
        }

        eprintln!("[Updater] Update applied. Restarting...");

        // Restart application
        Command::new(&current_exe)
            .spawn()
            .context("Failed to restart application")?;

        std::process::exit(0);
    }
}
