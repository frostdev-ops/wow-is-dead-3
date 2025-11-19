use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use sysinfo::Disks;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

use walkdir::WalkDir;

use super::download_manager::{
    calculate_optimal_concurrency, DownloadManager, DownloadPriority, DownloadTask, HashType,
};

const MAX_DOWNLOAD_RETRIES: u32 = 3;
const MANIFEST_FETCH_TIMEOUT_SECS: u64 = 10;
const MANIFEST_HASH_FILE: &str = ".wowid3-manifest-hash";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFile {
    pub path: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    pub minecraft_version: String,
    pub fabric_loader: String,
    pub files: Vec<ManifestFile>,
    pub changelog: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub current_file: usize,
    pub total_files: usize,
    pub current_bytes: u64,
    pub total_bytes: u64,
    pub current_file_name: String,
}

/// Check for modpack updates by fetching the manifest
pub async fn check_for_updates(manifest_url: &str) -> Result<Manifest> {
    eprintln!("[Updater] Fetching manifest from: {}", manifest_url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(MANIFEST_FETCH_TIMEOUT_SECS))
        .build()
        .context("Failed to create HTTP client")?;

    let response = client
        .get(manifest_url)
        .send()
        .await
        .context(format!(
            "Failed to fetch manifest from URL '{}'. Check your network connection and verify the server is reachable.",
            manifest_url
        ))?;

    let status = response.status();
    if !status.is_success() {
        anyhow::bail!(
            "Manifest request failed with HTTP status {}: {} (URL: {})",
            status.as_u16(),
            status.canonical_reason().unwrap_or("Unknown error"),
            manifest_url
        );
    }

    eprintln!("[Updater] Manifest fetched successfully, parsing JSON...");

    let manifest: Manifest = response
        .json()
        .await
        .context("Failed to parse manifest JSON - server returned invalid JSON")?;

    eprintln!("[Updater] Manifest parsed successfully: version {}", manifest.version);

    Ok(manifest)
}

/// Calculate manifest hash - combines all file hashes to detect manifest changes
pub fn calculate_manifest_hash(manifest: &Manifest) -> String {
    let mut hasher = Sha256::new();

    // Hash version
    hasher.update(manifest.version.as_bytes());
    hasher.update(b"|");

    // Hash all file checksums in deterministic order (sorted by path)
    // This ensures manifest hash is stable even if server reorders files
    let mut files = manifest.files.clone();
    files.sort_by(|a, b| a.path.cmp(&b.path));

    for file in files {
        hasher.update(file.sha256.as_bytes());
        hasher.update(b"|");
    }

    format!("{:x}", hasher.finalize())
}

/// Get the stored manifest hash
async fn get_stored_manifest_hash(game_dir: &PathBuf) -> Result<Option<String>> {
    let hash_file = game_dir.join(MANIFEST_HASH_FILE);

    if hash_file.exists() {
        let content = fs::read_to_string(&hash_file)
            .await
            .context("Failed to read manifest hash file")?;
        Ok(Some(content.trim().to_string()))
    } else {
        Ok(None)
    }
}

/// Save the manifest hash
async fn save_manifest_hash(game_dir: &PathBuf, hash: &str) -> Result<()> {
    let hash_file = game_dir.join(MANIFEST_HASH_FILE);
    fs::write(&hash_file, hash)
        .await
        .context("Failed to write manifest hash file")?;
    Ok(())
}

/// Check if manifest has changed
pub async fn has_manifest_changed(manifest: &Manifest, game_dir: &PathBuf) -> Result<bool> {
    let current_hash = calculate_manifest_hash(manifest);
    let stored_hash = get_stored_manifest_hash(game_dir).await?;

    Ok(stored_hash.is_none() || stored_hash != Some(current_hash))
}

/// Verify SHA256 checksum of a file
async fn verify_file_checksum(file_path: &PathBuf, expected_sha256: &str) -> Result<bool> {
    if !file_path.exists() {
        return Ok(false);
    }

    let bytes = fs::read(file_path)
        .await
        .context("Failed to read file for checksum verification")?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    Ok(hash == expected_sha256)
}

/// Download and verify a single file with retry logic
#[allow(dead_code)]
pub async fn download_file_with_retry(
    file: &ManifestFile,
    base_dir: &PathBuf,
    max_retries: u32,
) -> Result<()> {
    let mut retries = 0;
    const RETRY_DELAY_MS: u64 = 1000;

    loop {
        match download_file(file, base_dir).await {
            Ok(_) => return Ok(()),
            Err(e) => {
                retries += 1;
                if retries >= max_retries {
                    return Err(e).context(format!(
                        "Failed to download {} after {} retries",
                        file.path, max_retries
                    ));
                }

                eprintln!(
                    "Download failed for {} (attempt {}/{}): {}. Retrying...",
                    file.path, retries, max_retries, e
                );

                tokio::time::sleep(tokio::time::Duration::from_millis(
                    RETRY_DELAY_MS * retries as u64,
                ))
                .await;
            }
        }
    }
}

/// Download and verify a single file
#[allow(dead_code)]
pub async fn download_file(file: &ManifestFile, base_dir: &PathBuf) -> Result<()> {
    let file_path = base_dir.join(&file.path);

    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .await
            .context("Failed to create parent directories")?;
    }

    // Download file
    let response = reqwest::get(&file.url)
        .await
        .context(format!("Failed to download file from {}", file.url))?;

    if !response.status().is_success() {
        anyhow::bail!("Download request failed with status: {}", response.status());
    }

    let bytes = response
        .bytes()
        .await
        .context("Failed to read response bytes")?;

    // Verify SHA256 checksum
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    if hash != file.sha256 {
        anyhow::bail!(
            "Checksum mismatch for {}: expected {}, got {}",
            file.path,
            file.sha256,
            hash
        );
    }

    // Write file to disk
    let mut f = fs::File::create(&file_path)
        .await
        .context("Failed to create file")?;
    f.write_all(&bytes)
        .await
        .context("Failed to write file contents")?;
    f.flush()
        .await
        .context("Failed to flush file contents")?;
    f.sync_all()
        .await
        .context("Failed to sync file to disk")?;

    Ok(())
}

/// Get installed modpack version
pub async fn get_installed_version(game_dir: &PathBuf) -> Result<Option<String>> {
    let version_file = game_dir.join(".wowid3-version");

    if version_file.exists() {
        let content = fs::read_to_string(version_file)
            .await
            .context("Failed to read version file")?;
        Ok(Some(content.trim().to_string()))
    } else {
        Ok(None)
    }
}

/// Update .wowid3-version file
pub async fn update_version_file(game_dir: &PathBuf, version: &str) -> Result<()> {
    let version_file = game_dir.join(".wowid3-version");
    fs::write(version_file, version)
        .await
        .context("Failed to write version file")?;
    Ok(())
}

/// Clean up extra files not in the manifest, respecting ignore patterns from server
async fn cleanup_extra_files(manifest: &Manifest, game_dir: &PathBuf) -> Result<()> {
    let game_dir = game_dir.clone();
    let manifest_files: std::collections::HashSet<String> = manifest
        .files
        .iter()
        .map(|f| f.path.replace('\\', "/"))
        .collect();
    
    let ignore_patterns = manifest.ignore_patterns.clone();

    println!("[Cleanup] Starting cleanup of extra files...");
    println!("[Cleanup] Using {} ignore patterns from server", ignore_patterns.len());

    tokio::task::spawn_blocking(move || {
        let mut removed_count = 0;
        let mut kept_count = 0;

        let walker = WalkDir::new(&game_dir).follow_links(false);

        for entry in walker.into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            
            // Skip the game_dir itself
            if path == game_dir {
                continue;
            }

            // We only delete files, not directories
            if !path.is_file() {
                continue;
            }

            let relative_path = match path.strip_prefix(&game_dir) {
                Ok(p) => p.to_string_lossy().replace('\\', "/"),
                Err(_) => continue,
            };

            // Check if in manifest
            if manifest_files.contains(&relative_path) {
                continue;
            }

            // Check against server-provided ignore patterns
            let mut should_ignore = false;
            
            for pattern in &ignore_patterns {
                // Exact match
                if &relative_path == pattern {
                    should_ignore = true;
                    break;
                }
                
                // Prefix match (e.g., "logs/" matches "logs/debug.log")
                if pattern.ends_with('/') && relative_path.starts_with(pattern) {
                    should_ignore = true;
                    break;
                }
                
                // Wildcard at start (e.g., "*cache/" matches "resourcecache/", "any/path/webcache/")
                if pattern.starts_with('*') && pattern.ends_with('/') {
                    let suffix = &pattern[1..]; // Remove leading *
                    // Check if any path component matches the pattern
                    if relative_path.split('/').any(|part| part.ends_with(&suffix[..suffix.len()-1])) {
                        should_ignore = true;
                        break;
                    }
                }
                
                // Wildcard at end (e.g., "user*" matches "user.dat", "userconfig.json")
                if pattern.ends_with('*') {
                    let prefix = &pattern[..pattern.len()-1]; // Remove trailing *
                    // Get just the filename for comparison
                    if let Some(filename) = relative_path.split('/').last() {
                        if filename.starts_with(prefix) {
                            should_ignore = true;
                            break;
                        }
                    }
                }
            }

            if should_ignore {
                kept_count += 1;
                continue;
            }

            // If we got here, delete it
            println!("[Cleanup] Deleting extra file: {}", relative_path);
            if let Err(e) = std::fs::remove_file(path) {
                eprintln!("[Cleanup] Failed to delete {}: {}", relative_path, e);
            } else {
                removed_count += 1;
            }
        }

        println!(
            "[Cleanup] Finished. Removed {} files, kept {} ignored files.",
            removed_count, kept_count
        );
        Ok(())
    })
    .await
    .context("Cleanup task panicked")?
}

/// Check if there's enough disk space for the download
pub fn check_disk_space(game_dir: &PathBuf, required_bytes: u64) -> Result<()> {
    let disks = Disks::new_with_refreshed_list();

    // Canonicalize the path to handle relative paths and resolve symlinks
    let canonical_path = match std::fs::canonicalize(game_dir) {
        Ok(path) => path,
        Err(_) => {
            // If canonicalize fails (e.g., directory doesn't exist yet), try to create it and retry
            if let Err(e) = std::fs::create_dir_all(game_dir) {
                eprintln!("Warning: Could not create directory for disk space check: {}", e);
                return Ok(()); // Proceed anyway
            }
            match std::fs::canonicalize(game_dir) {
                Ok(path) => path,
                Err(e) => {
                    eprintln!("Warning: Could not determine absolute path for disk space check: {}", e);
                    return Ok(()); // Proceed anyway
                }
            }
        }
    };

    // On Windows, canonicalize adds the \\?\ prefix for extended-length paths
    // Strip it for mount point comparison
    let game_dir_str = {
        let path_str = canonical_path.to_string_lossy().to_string();
        #[cfg(target_os = "windows")]
        {
            if path_str.starts_with("\\\\?\\") {
                path_str[4..].to_string()
            } else {
                path_str
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            path_str
        }
    };

    // Find the disk that contains our game directory
    for disk in &disks {
        let mount_point = disk.mount_point().to_string_lossy();

        // On Windows, mount points are drive letters like "C:\\"
        // On Unix, mount points are paths like "/" or "/home"
        // Check if the canonical path starts with the mount point
        if game_dir_str.starts_with(mount_point.as_ref()) {
            let available = disk.available_space();

            // Add 10% buffer for safety
            let required_with_buffer = required_bytes + (required_bytes / 10);

            if available < required_with_buffer {
                anyhow::bail!(
                    "Insufficient disk space: {} MB available, {} MB required",
                    available / 1024 / 1024,
                    required_with_buffer / 1024 / 1024
                );
            }

            eprintln!(
                "[Disk Space] OK: {} MB available, {} MB required (at {})",
                available / 1024 / 1024,
                required_with_buffer / 1024 / 1024,
                mount_point
            );
            return Ok(());
        }
    }

    // If we can't find the disk, log but proceed anyway (better than blocking)
    eprintln!(
        "[Disk Space] Warning: Could not determine disk for '{}' - proceeding anyway",
        game_dir_str
    );
    Ok(())
}

/// Determine which files need to be downloaded (delta update)
pub async fn get_files_to_download(
    manifest: &Manifest,
    game_dir: &PathBuf,
) -> Result<Vec<ManifestFile>> {
    let mut files_to_download = Vec::new();

    for file in &manifest.files {
        let file_path = game_dir.join(&file.path);

        // Download if file doesn't exist or checksum doesn't match
        if !file_path.exists() {
            eprintln!("[Delta] Missing: {}", file.path);
            files_to_download.push(file.clone());
        } else {
            match verify_file_checksum(&file_path, &file.sha256).await {
                Ok(true) => {
                    // File exists and checksum matches, skip
                    continue;
                }
                Ok(false) => {
                    // Checksum mismatch, need to re-download
                    eprintln!("[Delta] Checksum mismatch: {} (expected: {}, size in manifest: {})", file.path, file.sha256, file.size);
                    files_to_download.push(file.clone());
                }
                Err(e) => {
                    // Error verifying checksum, re-download to be safe
                    eprintln!("[Delta] Error verifying {}: {}. Will re-download.", file.path, e);
                    files_to_download.push(file.clone());
                }
            }
        }
    }

    Ok(files_to_download)
}

/// Calculate total size of files to download
pub fn calculate_total_size(files: &[ManifestFile]) -> u64 {
    files.iter().map(|f| f.size).sum()
}

/// Install or update modpack with delta updates
pub async fn install_modpack(
    manifest: &Manifest,
    game_dir: &PathBuf,
    progress_callback: impl Fn(usize, usize, String, u64, u64) + Send + Sync + 'static,
) -> Result<()> {
    // Ensure game directory exists
    if !game_dir.exists() {
        fs::create_dir_all(game_dir)
            .await
            .context("Failed to create game directory")?;
    }

    // Determine which files need downloading (delta update)
    let files_to_download = get_files_to_download(manifest, game_dir).await?;

    if !files_to_download.is_empty() {
        // Check disk space
        let total_bytes = calculate_total_size(&files_to_download);
        check_disk_space(game_dir, total_bytes)?;

        println!(
            "Downloading {} files ({} MB)",
            files_to_download.len(),
            total_bytes / 1024 / 1024
        );

        // Create download manager with optimal concurrency
        let concurrency = calculate_optimal_concurrency();
        let download_manager = DownloadManager::new(concurrency, MAX_DOWNLOAD_RETRIES)
            .context("Failed to create download manager")?;

        // Convert manifest files to download tasks
        let tasks: Vec<DownloadTask> = files_to_download
            .iter()
            .map(|file| DownloadTask {
                url: file.url.clone(),
                dest: game_dir.join(&file.path),
                expected_hash: HashType::Sha256(file.sha256.clone()),
                priority: DownloadPriority::Low, // Modpack files are lower priority than game files
                size: file.size,
            })
            .collect();

        // Track progress across all parallel downloads
        let (progress_tx, mut progress_rx) =
            tokio::sync::mpsc::channel::<super::download_manager::DownloadProgress>(100);
        let total_files = files_to_download.len();
        let bytes_downloaded = Arc::new(Mutex::new(0u64));
        let files_completed = Arc::new(Mutex::new(0usize));

        // Spawn progress tracking task
        let bytes_downloaded_clone = bytes_downloaded.clone();
        let files_completed_clone = files_completed.clone();
        let progress_task = tokio::spawn(async move {
            while let Some(progress) = progress_rx.recv().await {
                if progress.completed {
                    let mut completed = files_completed_clone.lock().await;
                    *completed += 1;
                    let mut bytes = bytes_downloaded_clone.lock().await;
                    *bytes += progress.total_bytes;
                    let current_completed = *completed;
                    let current_bytes = *bytes;
                    drop(completed);
                    drop(bytes);

                    progress_callback(
                        current_completed,
                        total_files,
                        progress.url.clone(),
                        current_bytes,
                        total_bytes,
                    );
                }
            }
        });

        // Download all files in parallel
        download_manager
            .download_files(tasks, Some(progress_tx))
            .await
            .context("Failed to download modpack files")?;

        // Wait for progress tracking to complete
        progress_task.await?;
    } else {
        println!("All files up to date, no downloads needed");
    }

    // Clean up extra files not in the manifest
    cleanup_extra_files(manifest, game_dir).await?;

    // Update version file
    update_version_file(game_dir, &manifest.version).await?;

    // Save manifest hash to detect future changes
    let manifest_hash = calculate_manifest_hash(manifest);
    save_manifest_hash(game_dir, &manifest_hash).await?;

    println!("Modpack installation complete: version {}", manifest.version);
    Ok(())
}

/// Verify and repair modpack - checks all files against manifest checksums
/// and re-downloads any corrupted files, even if version matches
pub async fn verify_and_repair_modpack(
    manifest: &Manifest,
    game_dir: &PathBuf,
    progress_callback: impl Fn(usize, usize, String, u64, u64) + Send + Sync + 'static,
) -> Result<()> {
    // Ensure game directory exists
    if !game_dir.exists() {
        fs::create_dir_all(game_dir)
            .await
            .context("Failed to create game directory")?;
    }

    println!("[Repair] Starting modpack verification...");

    // Check all files for corruption
    let files_to_repair = get_files_to_download(manifest, game_dir).await?;

    if files_to_repair.is_empty() {
        println!("[Repair] ✓ All files verified - no corruption detected");
        return Ok(());
    }

    println!(
        "[Repair] Found {} corrupted/missing files to repair",
        files_to_repair.len()
    );

    // Check disk space for repairs
    let total_bytes = calculate_total_size(&files_to_repair);
    check_disk_space(game_dir, total_bytes)?;

    println!(
        "[Repair] Re-downloading {} files ({} MB)",
        files_to_repair.len(),
        total_bytes / 1024 / 1024
    );

    // Create download manager with optimal concurrency
    let concurrency = calculate_optimal_concurrency();
    let download_manager = DownloadManager::new(concurrency, MAX_DOWNLOAD_RETRIES)
        .context("Failed to create download manager")?;

    // Convert manifest files to download tasks
    let tasks: Vec<DownloadTask> = files_to_repair
        .iter()
        .map(|file| DownloadTask {
            url: file.url.clone(),
            dest: game_dir.join(&file.path),
            expected_hash: HashType::Sha256(file.sha256.clone()),
            priority: DownloadPriority::Low,
            size: file.size,
        })
        .collect();

    // Track progress across all parallel downloads
    let (progress_tx, mut progress_rx) =
        tokio::sync::mpsc::channel::<super::download_manager::DownloadProgress>(100);
    let total_files = files_to_repair.len();
    let bytes_downloaded = Arc::new(Mutex::new(0u64));
    let files_completed = Arc::new(Mutex::new(0usize));

    // Spawn progress tracking task
    let bytes_downloaded_clone = bytes_downloaded.clone();
    let files_completed_clone = files_completed.clone();
    let progress_task = tokio::spawn(async move {
        while let Some(progress) = progress_rx.recv().await {
            if progress.completed {
                let mut completed = files_completed_clone.lock().await;
                *completed += 1;
                let mut bytes = bytes_downloaded_clone.lock().await;
                *bytes += progress.total_bytes;
                let current_completed = *completed;
                let current_bytes = *bytes;
                drop(completed);
                drop(bytes);

                progress_callback(
                    current_completed,
                    total_files,
                    progress.url.clone(),
                    current_bytes,
                    total_bytes,
                );
            }
        }
    });

    // Download all corrupted files in parallel
    download_manager
        .download_files(tasks, Some(progress_tx))
        .await
        .context("Failed to repair modpack files")?;

    // Wait for progress tracking to complete
    progress_task.await?;

    // Save manifest hash to prevent re-detection of these files on next repair
    let manifest_hash = calculate_manifest_hash(manifest);
    save_manifest_hash(game_dir, &manifest_hash).await?;

    println!("[Repair] ✓ Modpack repair complete!");
    println!("[Repair] Repaired {} files", files_to_repair.len());

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_get_installed_version_no_file() {
        let temp_dir = TempDir::new().unwrap();
        let result = get_installed_version(&temp_dir.path().to_path_buf())
            .await
            .unwrap();
        assert_eq!(result, None);
    }

    #[tokio::test]
    async fn test_get_installed_version_with_file() {
        let temp_dir = TempDir::new().unwrap();
        let version_file = temp_dir.path().join(".wowid3-version");

        std::fs::write(&version_file, "1.0.0").unwrap();

        let result = get_installed_version(&temp_dir.path().to_path_buf())
            .await
            .unwrap();
        assert_eq!(result, Some("1.0.0".to_string()));
    }

    #[tokio::test]
    async fn test_update_version_file() {
        let temp_dir = TempDir::new().unwrap();

        update_version_file(&temp_dir.path().to_path_buf(), "2.0.0")
            .await
            .unwrap();

        let version_file = temp_dir.path().join(".wowid3-version");
        let content = std::fs::read_to_string(version_file).unwrap();
        assert_eq!(content, "2.0.0");
    }

    #[tokio::test]
    async fn test_verify_file_checksum_missing_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("missing.txt");

        let result = verify_file_checksum(&file_path, "abc123").await.unwrap();
        assert_eq!(result, false);
    }

    #[tokio::test]
    async fn test_verify_file_checksum_correct() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        // Write test content
        std::fs::write(&file_path, "hello world").unwrap();

        // Calculate expected SHA256 for "hello world"
        let mut hasher = Sha256::new();
        hasher.update(b"hello world");
        let expected = format!("{:x}", hasher.finalize());

        let result = verify_file_checksum(&file_path, &expected).await.unwrap();
        assert_eq!(result, true);
    }

    #[tokio::test]
    async fn test_verify_file_checksum_incorrect() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        std::fs::write(&file_path, "hello world").unwrap();

        let result = verify_file_checksum(&file_path, "wronghash").await.unwrap();
        assert_eq!(result, false);
    }

    #[tokio::test]
    async fn test_calculate_total_size() {
        let files = vec![
            ManifestFile {
                path: "file1.txt".to_string(),
                url: "http://example.com/file1.txt".to_string(),
                sha256: "abc123".to_string(),
                size: 1024,
            },
            ManifestFile {
                path: "file2.txt".to_string(),
                url: "http://example.com/file2.txt".to_string(),
                sha256: "def456".to_string(),
                size: 2048,
            },
        ];

        let total = calculate_total_size(&files);
        assert_eq!(total, 3072);
    }

    #[tokio::test]
    async fn test_get_files_to_download_all_new() {
        let temp_dir = TempDir::new().unwrap();

        let manifest = Manifest {
            version: "1.0.0".to_string(),
            minecraft_version: "1.20.1".to_string(),
            fabric_loader: "0.15.0".to_string(),
            changelog: "Initial release".to_string(),
            files: vec![
                ManifestFile {
                    path: "mods/mod1.jar".to_string(),
                    url: "http://example.com/mod1.jar".to_string(),
                    sha256: "abc123".to_string(),
                    size: 1024,
                },
            ],
        };

        let files_to_download = get_files_to_download(&manifest, &temp_dir.path().to_path_buf())
            .await
            .unwrap();

        assert_eq!(files_to_download.len(), 1);
    }

    #[tokio::test]
    async fn test_get_files_to_download_with_existing() {
        let temp_dir = TempDir::new().unwrap();

        // Create a file with correct checksum
        let mods_dir = temp_dir.path().join("mods");
        std::fs::create_dir_all(&mods_dir).unwrap();
        let file_path = mods_dir.join("mod1.jar");
        std::fs::write(&file_path, "test content").unwrap();

        // Calculate checksum
        let mut hasher = Sha256::new();
        hasher.update(b"test content");
        let checksum = format!("{:x}", hasher.finalize());

        let manifest = Manifest {
            version: "1.0.0".to_string(),
            minecraft_version: "1.20.1".to_string(),
            fabric_loader: "0.15.0".to_string(),
            changelog: "Update".to_string(),
            files: vec![
                ManifestFile {
                    path: "mods/mod1.jar".to_string(),
                    url: "http://example.com/mod1.jar".to_string(),
                    sha256: checksum.clone(),
                    size: 12,
                },
                ManifestFile {
                    path: "mods/mod2.jar".to_string(),
                    url: "http://example.com/mod2.jar".to_string(),
                    sha256: "newfile".to_string(),
                    size: 2048,
                },
            ],
        };

        let files_to_download = get_files_to_download(&manifest, &temp_dir.path().to_path_buf())
            .await
            .unwrap();

        // Should only download mod2.jar since mod1.jar exists and has correct checksum
        assert_eq!(files_to_download.len(), 1);
        assert_eq!(files_to_download[0].path, "mods/mod2.jar");
    }

    #[tokio::test]
    async fn test_get_files_to_download_checksum_mismatch() {
        let temp_dir = TempDir::new().unwrap();

        // Create a file with incorrect checksum
        let mods_dir = temp_dir.path().join("mods");
        std::fs::create_dir_all(&mods_dir).unwrap();
        let file_path = mods_dir.join("mod1.jar");
        std::fs::write(&file_path, "old content").unwrap();

        let manifest = Manifest {
            version: "1.0.0".to_string(),
            minecraft_version: "1.20.1".to_string(),
            fabric_loader: "0.15.0".to_string(),
            changelog: "Update".to_string(),
            files: vec![
                ManifestFile {
                    path: "mods/mod1.jar".to_string(),
                    url: "http://example.com/mod1.jar".to_string(),
                    sha256: "wrongchecksum".to_string(),
                    size: 1024,
                },
            ],
        };

        let files_to_download = get_files_to_download(&manifest, &temp_dir.path().to_path_buf())
            .await
            .unwrap();

        // Should download mod1.jar since checksum doesn't match
        assert_eq!(files_to_download.len(), 1);
        assert_eq!(files_to_download[0].path, "mods/mod1.jar");
    }
}

// Integration tests with wiremock
#[cfg(test)]
mod integration_tests {
    use super::*;
    use sha2::{Digest, Sha256};
    use tempfile::TempDir;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn test_check_for_updates_success() {
        let mock_server = MockServer::start().await;

        let manifest_json = r#"{
            "version": "1.0.0",
            "minecraft_version": "1.20.1",
            "fabric_loader": "0.15.0",
            "changelog": "Test release",
            "files": []
        }"#;

        Mock::given(method("GET"))
            .and(path("/manifest.json"))
            .respond_with(ResponseTemplate::new(200).set_body_string(manifest_json))
            .mount(&mock_server)
            .await;

        let url = format!("{}/manifest.json", &mock_server.uri());
        let result = check_for_updates(&url).await;

        assert!(result.is_ok());
        let manifest = result.unwrap();
        assert_eq!(manifest.version, "1.0.0");
        assert_eq!(manifest.minecraft_version, "1.20.1");
    }

    #[tokio::test]
    async fn test_check_for_updates_network_error() {
        // Use an invalid URL to trigger network error
        let result = check_for_updates("http://localhost:1/nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_check_for_updates_invalid_json() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/manifest.json"))
            .respond_with(ResponseTemplate::new(200).set_body_string("invalid json"))
            .mount(&mock_server)
            .await;

        let url = format!("{}/manifest.json", &mock_server.uri());
        let result = check_for_updates(&url).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_download_file_success() {
        let mock_server = MockServer::start().await;
        let temp_dir = TempDir::new().unwrap();

        let file_content = b"test file content";
        let mut hasher = Sha256::new();
        hasher.update(file_content);
        let checksum = format!("{:x}", hasher.finalize());

        Mock::given(method("GET"))
            .and(path("/test.txt"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(file_content))
            .mount(&mock_server)
            .await;

        let file = ManifestFile {
            path: "test.txt".to_string(),
            url: format!("{}/test.txt", &mock_server.uri()),
            sha256: checksum.clone(),
            size: file_content.len() as u64,
        };

        let result = download_file(&file, &temp_dir.path().to_path_buf()).await;
        assert!(result.is_ok());

        // Verify file was written correctly
        let written_content = std::fs::read(temp_dir.path().join("test.txt")).unwrap();
        assert_eq!(written_content, file_content);
    }

    #[tokio::test]
    async fn test_download_file_checksum_mismatch() {
        let mock_server = MockServer::start().await;
        let temp_dir = TempDir::new().unwrap();

        let file_content = b"test file content";

        Mock::given(method("GET"))
            .and(path("/test.txt"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(file_content))
            .mount(&mock_server)
            .await;

        let file = ManifestFile {
            path: "test.txt".to_string(),
            url: format!("{}/test.txt", &mock_server.uri()),
            sha256: "wrongchecksum".to_string(),
            size: file_content.len() as u64,
        };

        let result = download_file(&file, &temp_dir.path().to_path_buf()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Checksum mismatch"));
    }

    #[tokio::test]
    async fn test_download_file_with_retry_success_on_second_attempt() {
        let mock_server = MockServer::start().await;
        let temp_dir = TempDir::new().unwrap();

        let file_content = b"test file content";
        let mut hasher = Sha256::new();
        hasher.update(file_content);
        let checksum = format!("{:x}", hasher.finalize());

        // First request fails, second succeeds
        Mock::given(method("GET"))
            .and(path("/test.txt"))
            .respond_with(ResponseTemplate::new(500))
            .up_to_n_times(1)
            .mount(&mock_server)
            .await;

        Mock::given(method("GET"))
            .and(path("/test.txt"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(file_content))
            .mount(&mock_server)
            .await;

        let file = ManifestFile {
            path: "test.txt".to_string(),
            url: format!("{}/test.txt", &mock_server.uri()),
            sha256: checksum.clone(),
            size: file_content.len() as u64,
        };

        let result = download_file_with_retry(&file, &temp_dir.path().to_path_buf(), 3).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_download_file_with_retry_fails_after_max_retries() {
        let mock_server = MockServer::start().await;
        let temp_dir = TempDir::new().unwrap();

        // Always fail
        Mock::given(method("GET"))
            .and(path("/test.txt"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&mock_server)
            .await;

        let file = ManifestFile {
            path: "test.txt".to_string(),
            url: format!("{}/test.txt", &mock_server.uri()),
            sha256: "somechecksum".to_string(),
            size: 100,
        };

        let result = download_file_with_retry(&file, &temp_dir.path().to_path_buf(), 2).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("after 2 retries"));
    }

    #[tokio::test]
    async fn test_install_modpack_first_time() {
        let mock_server = MockServer::start().await;
        let temp_dir = TempDir::new().unwrap();

        let file1_content = b"mod1 content";
        let file2_content = b"mod2 content";

        let mut hasher1 = Sha256::new();
        hasher1.update(file1_content);
        let checksum1 = format!("{:x}", hasher1.finalize());

        let mut hasher2 = Sha256::new();
        hasher2.update(file2_content);
        let checksum2 = format!("{:x}", hasher2.finalize());

        Mock::given(method("GET"))
            .and(path("/mod1.jar"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(file1_content))
            .mount(&mock_server)
            .await;

        Mock::given(method("GET"))
            .and(path("/mod2.jar"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(file2_content))
            .mount(&mock_server)
            .await;

        let manifest = Manifest {
            version: "1.0.0".to_string(),
            minecraft_version: "1.20.1".to_string(),
            fabric_loader: "0.15.0".to_string(),
            changelog: "Initial release".to_string(),
            files: vec![
                ManifestFile {
                    path: "mods/mod1.jar".to_string(),
                    url: format!("{}/mod1.jar", &mock_server.uri()),
                    sha256: checksum1,
                    size: file1_content.len() as u64,
                },
                ManifestFile {
                    path: "mods/mod2.jar".to_string(),
                    url: format!("{}/mod2.jar", &mock_server.uri()),
                    sha256: checksum2,
                    size: file2_content.len() as u64,
                },
            ],
        };

        let result = install_modpack(&manifest, &temp_dir.path().to_path_buf(), |current, total, filename, _current_bytes, _total_bytes| {
            // Verify progress callback is called with reasonable values
            assert!(current <= total);
            assert!(total == 2); // We have 2 files
            assert!(!filename.is_empty());
        })
        .await;

        assert!(result.is_ok());

        // Verify files were downloaded
        assert!(temp_dir.path().join("mods/mod1.jar").exists());
        assert!(temp_dir.path().join("mods/mod2.jar").exists());

        // Verify version file was created
        let version = get_installed_version(&temp_dir.path().to_path_buf())
            .await
            .unwrap();
        assert_eq!(version, Some("1.0.0".to_string()));
    }

    #[tokio::test]
    async fn test_install_modpack_delta_update() {
        let mock_server = MockServer::start().await;
        let temp_dir = TempDir::new().unwrap();

        // Create existing file
        let mods_dir = temp_dir.path().join("mods");
        std::fs::create_dir_all(&mods_dir).unwrap();

        let file1_content = b"mod1 content";
        std::fs::write(mods_dir.join("mod1.jar"), file1_content).unwrap();

        let mut hasher1 = Sha256::new();
        hasher1.update(file1_content);
        let checksum1 = format!("{:x}", hasher1.finalize());

        // New file to download
        let file2_content = b"mod2 content";
        let mut hasher2 = Sha256::new();
        hasher2.update(file2_content);
        let checksum2 = format!("{:x}", hasher2.finalize());

        Mock::given(method("GET"))
            .and(path("/mod2.jar"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(file2_content))
            .mount(&mock_server)
            .await;

        let manifest = Manifest {
            version: "1.1.0".to_string(),
            minecraft_version: "1.20.1".to_string(),
            fabric_loader: "0.15.0".to_string(),
            changelog: "Update".to_string(),
            files: vec![
                ManifestFile {
                    path: "mods/mod1.jar".to_string(),
                    url: format!("{}/mod1.jar", &mock_server.uri()),
                    sha256: checksum1,
                    size: file1_content.len() as u64,
                },
                ManifestFile {
                    path: "mods/mod2.jar".to_string(),
                    url: format!("{}/mod2.jar", &mock_server.uri()),
                    sha256: checksum2,
                    size: file2_content.len() as u64,
                },
            ],
        };

        let result = install_modpack(&manifest, &temp_dir.path().to_path_buf(), |current, total, filename, _current_bytes, _total_bytes| {
            // Only mod2.jar needs downloading, so total should be 1
            assert_eq!(total, 1);
            assert_eq!(current, 1);
            assert!(!filename.is_empty());
        })
        .await;

        assert!(result.is_ok());

        // Verify both files exist
        assert!(temp_dir.path().join("mods/mod1.jar").exists());
        assert!(temp_dir.path().join("mods/mod2.jar").exists());

        // Verify version was updated
        let version = get_installed_version(&temp_dir.path().to_path_buf())
            .await
            .unwrap();
        assert_eq!(version, Some("1.1.0".to_string()));
    }

    #[tokio::test]
    async fn test_install_modpack_no_updates_needed() {
        let temp_dir = TempDir::new().unwrap();

        // Create existing files with correct checksums
        let mods_dir = temp_dir.path().join("mods");
        std::fs::create_dir_all(&mods_dir).unwrap();

        let file_content = b"mod1 content";
        std::fs::write(mods_dir.join("mod1.jar"), file_content).unwrap();

        let mut hasher = Sha256::new();
        hasher.update(file_content);
        let checksum = format!("{:x}", hasher.finalize());

        let manifest = Manifest {
            version: "1.0.0".to_string(),
            minecraft_version: "1.20.1".to_string(),
            fabric_loader: "0.15.0".to_string(),
            changelog: "No changes".to_string(),
            files: vec![ManifestFile {
                path: "mods/mod1.jar".to_string(),
                url: "http://example.com/mod1.jar".to_string(),
                sha256: checksum,
                size: file_content.len() as u64,
            }],
        };

        let result = install_modpack(&manifest, &temp_dir.path().to_path_buf(), |_current, _total, _filename, _current_bytes, _total_bytes| {
            // Should never be called since no downloads needed
            panic!("Progress callback should not be called when no files need downloading");
        })
        .await;

        assert!(result.is_ok());

        // Verify version was still updated
        let version = get_installed_version(&temp_dir.path().to_path_buf())
            .await
            .unwrap();
        assert_eq!(version, Some("1.0.0".to_string()));
    }
}
