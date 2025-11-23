use anyhow::{Result, Context};
use serde::{Serialize, Deserialize};
use tauri::AppHandle;
use std::time::Duration;
use sha2::{Digest, Sha256};
use std::env;
use std::process::Command;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;

const LAUNCHER_MANIFEST_URL: &str = "https://wowid-launcher.frostdev.io/api/launcher/latest/executable";

// Old single-file manifest format (for backward compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherManifest {
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
    pub changelog: String,
    pub mandatory: bool,
}

// New multi-platform manifest format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherVersion {
    pub version: String,
    pub files: Vec<LauncherFile>,
    pub changelog: String,
    pub mandatory: bool,
    pub released_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherFile {
    pub platform: String,
    pub filename: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
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

    let response_text = response.text().await
        .context("Failed to read response body")?;

    // Try parsing as new multi-platform format first
    if let Ok(launcher_version) = serde_json::from_str::<LauncherVersion>(&response_text) {
        eprintln!("[Launcher Updater] Using new multi-platform format");
        eprintln!("[Launcher Updater] Remote launcher version: {}", launcher_version.version);

        // Determine current platform
        let current_platform = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "linux") {
            "linux"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else {
            "unknown"
        };

        // Find the file for the current platform
        let platform_file = launcher_version.files.iter()
            .find(|f| f.platform == current_platform)
            .context(format!("No launcher file found for platform: {}", current_platform))?;

        eprintln!("[Launcher Updater] Found file for platform {}: {}", current_platform, platform_file.filename);

        // Compare versions
        let update_available = is_newer_version(&launcher_version.version, &current_version.to_string());

        eprintln!("[Launcher Updater] Update available: {} (remote: {}, local: {})",
            update_available, launcher_version.version, current_version);

        return Ok(LauncherUpdateInfo {
            available: update_available,
            version: launcher_version.version,
            changelog: launcher_version.changelog,
            mandatory: launcher_version.mandatory,
            download_url: platform_file.url.clone(),
            sha256: platform_file.sha256.clone(),
        });
    }

    // Fall back to old single-file format
    if let Ok(manifest) = serde_json::from_str::<LauncherManifest>(&response_text) {
        eprintln!("[Launcher Updater] Using old single-file format");
        eprintln!("[Launcher Updater] Remote launcher version: {}", manifest.version);

        // Compare versions
        let update_available = is_newer_version(&manifest.version, &current_version.to_string());

        eprintln!("[Launcher Updater] Update available: {} (remote: {}, local: {})",
            update_available, manifest.version, current_version);

        return Ok(LauncherUpdateInfo {
            available: update_available,
            version: manifest.version,
            changelog: manifest.changelog,
            mandatory: manifest.mandatory,
            download_url: manifest.url,
            sha256: manifest.sha256,
        });
    }

    // If neither format worked, return an error
    anyhow::bail!("Failed to parse launcher manifest in any known format")
}

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

/// Install launcher update - platform-specific implementation
pub async fn install_launcher_update<F>(
    url: String,
    sha256: String,
    progress_callback: F
) -> Result<()>
where
    F: Fn(u64, u64) + Send + Sync + 'static
{
    // Common: Download and verify file
    eprintln!("[Updater] Downloading update from {}", url);
    let response = reqwest::get(&url).await.context("Failed to download update")?;
    let total_size = response.content_length().unwrap_or(0);

    let temp_dir = env::temp_dir();
    let temp_file = temp_dir.join(format!("launcher_update_{}", uuid::Uuid::new_v4()));

    let mut file = fs::File::create(&temp_file).await.context("Failed to create temp file")?;
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

    // Verify checksum
    let bytes = fs::read(&temp_file).await.context("Failed to read downloaded file")?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let calculated_hash = format!("{:x}", hasher.finalize());

    if calculated_hash != sha256 {
        fs::remove_file(&temp_file).await.ok();
        anyhow::bail!("Checksum mismatch. Expected {}, got {}", sha256, calculated_hash);
    }

    eprintln!("[Updater] Checksum verified. Applying update...");

    // Platform-specific update logic
    #[cfg(target_os = "windows")]
    {
        install_windows_update(temp_file).await?;
    }

    #[cfg(target_os = "linux")]
    {
        install_linux_appimage(temp_file).await?;
    }

    #[cfg(target_os = "macos")]
    {
        anyhow::bail!("macOS self-update not yet implemented");
    }

    Ok(())
}

#[cfg(target_os = "windows")]
async fn install_windows_update(temp_file: std::path::PathBuf) -> Result<()> {
    let current_exe = env::current_exe().context("Failed to get current executable path")?;
    let exe_dir = current_exe.parent().context("Failed to get executable directory")?;

    // Backup current exe
    let old_exe = current_exe.with_extension("exe.old");
    if old_exe.exists() {
        fs::remove_file(&old_exe).await.context("Failed to remove existing .old file")?;
    }

    // Backup: This should always be same filesystem, so rename is fine
    fs::rename(&current_exe, &old_exe).await.context("Failed to rename current executable")?;

    // Move new exe to current path (may be cross-drive on Windows)
    let new_exe = exe_dir.join(current_exe.file_name().context("No filename")?);
    if let Err(e) = move_file_cross_fs(&temp_file, &new_exe).await {
        // Rollback on failure
        eprintln!("[Updater] Failed to install update, rolling back: {}", e);
        fs::rename(&old_exe, &current_exe).await.ok();
        anyhow::bail!("Failed to move new executable: {}", e);
    }

    eprintln!("[Updater] Update applied. Restarting...");

    // Restart application
    Command::new(&new_exe)
        .spawn()
        .context("Failed to restart application")?;

    std::process::exit(0);
}

/// Helper function to move a file, handling cross-filesystem moves
async fn move_file_cross_fs(from: &std::path::Path, to: &std::path::Path) -> Result<()> {
    // Try rename first (fast, same filesystem)
    if fs::rename(from, to).await.is_ok() {
        return Ok(());
    }

    // Rename failed (likely cross-filesystem), fall back to copy+delete
    eprintln!("[Updater] Rename failed, using copy+delete for cross-filesystem move");
    fs::copy(from, to).await
        .context("Failed to copy file")?;
    fs::remove_file(from).await
        .context("Failed to remove source file after copy")?;
    Ok(())
}

#[cfg(target_os = "linux")]
async fn install_linux_appimage(temp_file: std::path::PathBuf) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    // Get current AppImage path (could be from APPIMAGE env var or current exe)
    let current_appimage = if let Ok(appimage_path) = env::var("APPIMAGE") {
        std::path::PathBuf::from(appimage_path)
    } else {
        env::current_exe().context("Failed to get current executable path")?
    };

    eprintln!("[Updater] Current AppImage: {:?}", current_appimage);

    // Backup current AppImage
    let backup_appimage = current_appimage.with_extension("AppImage.old");
    if backup_appimage.exists() {
        fs::remove_file(&backup_appimage).await.ok();
    }

    // Backup: This should always be same filesystem, so rename is fine
    fs::rename(&current_appimage, &backup_appimage)
        .await
        .context("Failed to backup current AppImage")?;

    // Move new AppImage to current path (may be cross-filesystem)
    if let Err(e) = move_file_cross_fs(&temp_file, &current_appimage).await {
        // Rollback on failure
        eprintln!("[Updater] Failed to install update, rolling back: {}", e);
        fs::rename(&backup_appimage, &current_appimage).await.ok();
        anyhow::bail!("Failed to move new AppImage: {}", e);
    }

    // Make executable
    let metadata = fs::metadata(&current_appimage).await?;
    let mut permissions = metadata.permissions();
    permissions.set_mode(0o755); // rwxr-xr-x
    fs::set_permissions(&current_appimage, permissions).await?;

    eprintln!("[Updater] Update applied. Restarting...");

    // Restart application
    Command::new(&current_appimage)
        .spawn()
        .context("Failed to restart application")?;

    std::process::exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_move_file_cross_fs_same_filesystem() {
        let temp_dir = env::temp_dir();
        let src = temp_dir.join("test_src.txt");
        let dst = temp_dir.join("test_dst.txt");

        // Create source file
        std::fs::write(&src, b"test content").unwrap();

        // Move file
        move_file_cross_fs(&src, &dst).await.unwrap();

        // Verify
        assert!(!src.exists(), "Source should be removed");
        assert!(dst.exists(), "Destination should exist");
        assert_eq!(std::fs::read_to_string(&dst).unwrap(), "test content");

        // Cleanup
        std::fs::remove_file(&dst).ok();
    }

    #[tokio::test]
    async fn test_move_file_cross_fs_with_copy_fallback() {
        // This test simulates cross-filesystem move by creating files
        // Even if on same filesystem, the function should still work
        let temp_dir = env::temp_dir();
        let src = temp_dir.join("test_src_2.txt");
        let dst = temp_dir.join("test_dst_2.txt");

        // Create source file with larger content to ensure copy works
        let content = vec![0u8; 1024 * 10]; // 10KB
        std::fs::write(&src, &content).unwrap();

        // Move file
        move_file_cross_fs(&src, &dst).await.unwrap();

        // Verify
        assert!(!src.exists(), "Source should be removed after move");
        assert!(dst.exists(), "Destination should exist after move");
        assert_eq!(std::fs::read(&dst).unwrap().len(), content.len());

        // Cleanup
        std::fs::remove_file(&dst).ok();
    }

    #[test]
    fn test_version_comparison() {
        assert!(is_newer_version("1.0.1", "1.0.0"));
        assert!(is_newer_version("2.0.0", "1.9.9"));
        assert!(is_newer_version("1.1.0", "1.0.9"));
        assert!(!is_newer_version("1.0.0", "1.0.0"));
        assert!(!is_newer_version("1.0.0", "1.0.1"));
        assert!(!is_newer_version("0.9.0", "1.0.0"));
    }
}
