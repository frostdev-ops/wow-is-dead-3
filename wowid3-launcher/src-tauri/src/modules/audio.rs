use anyhow::{Context, Result};
use std::path::PathBuf;
use std::time::Duration;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tauri::Manager;

const MAX_DOWNLOAD_RETRIES: u32 = 3;
const RETRY_DELAY_MS: u64 = 1000;
const MAX_AUDIO_SIZE_BYTES: u64 = 50 * 1024 * 1024; // 50 MB limit
const AUDIO_CACHE_DIR: &str = "cache/audio";

/// Get the cache directory for audio files
fn get_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
    let cache_dir = app_handle
        .path()
        .app_cache_dir()
        .context("Failed to get app cache directory")?
        .join(AUDIO_CACHE_DIR);

    Ok(cache_dir)
}

/// Check if audio is already cached
pub async fn get_cached_audio(app_handle: &tauri::AppHandle) -> Result<Option<String>> {
    let cache_dir = get_cache_dir(app_handle)?;
    let audio_file = cache_dir.join("wid3menu.mp3");

    if audio_file.exists() {
        eprintln!("[Audio] Found cached audio at: {}", audio_file.display());
        // Verify file size is reasonable (between 1 MB and 50 MB)
        let metadata = fs::metadata(&audio_file)
            .await
            .context("Failed to read audio file metadata")?;

        if metadata.len() > 1024 * 1024 && metadata.len() < MAX_AUDIO_SIZE_BYTES {
            return Ok(Some(audio_file.to_string_lossy().to_string()));
        } else {
            eprintln!(
                "[Audio] Cached audio has invalid size: {} bytes, will re-download",
                metadata.len()
            );
            // Delete corrupted cache
            let _ = fs::remove_file(&audio_file).await;
        }
    }

    eprintln!("[Audio] No cached audio found");
    Ok(None)
}

/// Download and cache audio file with retry logic
pub async fn download_and_cache_audio(
    app_handle: &tauri::AppHandle,
    url: String,
) -> Result<String> {
    eprintln!("[Audio] Starting download from: {}", url);

    let cache_dir = get_cache_dir(app_handle)?;
    fs::create_dir_all(&cache_dir)
        .await
        .context("Failed to create audio cache directory")?;

    let audio_file = cache_dir.join("wid3menu.mp3");
    let temp_file = cache_dir.join("wid3menu.mp3.tmp");

    // Try downloading with retries
    let mut retries = 0;
    loop {
        match download_audio_file(&url, &temp_file).await {
            Ok(file_size) => {
                eprintln!("[Audio] Download successful: {} bytes", file_size);

                // Verify file size
                if file_size < 1024 * 1024 || file_size > MAX_AUDIO_SIZE_BYTES {
                    eprintln!(
                        "[Audio] Downloaded file has invalid size: {} bytes",
                        file_size
                    );
                    let _ = fs::remove_file(&temp_file).await;
                    anyhow::bail!("Downloaded audio file size is invalid: {}", file_size);
                }

                // Move temp file to final location
                fs::rename(&temp_file, &audio_file)
                    .await
                    .context("Failed to move audio file to cache")?;

                eprintln!("[Audio] Cached audio at: {}", audio_file.display());
                return Ok(audio_file.to_string_lossy().to_string());
            }
            Err(e) => {
                retries += 1;
                if retries >= MAX_DOWNLOAD_RETRIES {
                    let _ = fs::remove_file(&temp_file).await;
                    eprintln!("[Audio] Download failed after {} retries: {}", MAX_DOWNLOAD_RETRIES, e);
                    return Err(e).context(format!(
                        "Failed to download audio after {} retries",
                        MAX_DOWNLOAD_RETRIES
                    ));
                }

                let delay_ms = RETRY_DELAY_MS * retries as u64;
                eprintln!(
                    "[Audio] Download failed (attempt {}/{}): {}. Retrying in {}ms...",
                    retries, MAX_DOWNLOAD_RETRIES, e, delay_ms
                );

                tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
            }
        }
    }
}

/// Download audio file from URL
async fn download_audio_file(url: &str, output_path: &PathBuf) -> Result<u64> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .context("Failed to create HTTP client")?;

    let response = client
        .get(url)
        .send()
        .await
        .context(format!("Failed to download audio from {}", url))?;

    if !response.status().is_success() {
        anyhow::bail!(
            "Audio download failed with HTTP status {}: {}",
            response.status().as_u16(),
            response.status().canonical_reason().unwrap_or("Unknown error")
        );
    }

    let bytes = response
        .bytes()
        .await
        .context("Failed to read response bytes")?;

    let file_size = bytes.len() as u64;

    // Create parent directories if they don't exist
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .await
            .context("Failed to create parent directories")?;
    }

    // Write to temp file
    let mut f = fs::File::create(output_path)
        .await
        .context("Failed to create audio file")?;

    f.write_all(&bytes)
        .await
        .context("Failed to write audio file contents")?;

    f.flush()
        .await
        .context("Failed to flush audio file")?;

    f.sync_all()
        .await
        .context("Failed to sync audio file to disk")?;

    Ok(file_size)
}

/// Clear audio cache (for testing/troubleshooting)
pub async fn clear_audio_cache(app_handle: &tauri::AppHandle) -> Result<()> {
    let cache_dir = get_cache_dir(app_handle)?;

    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)
            .await
            .context("Failed to remove audio cache directory")?;
        eprintln!("[Audio] Cache cleared: {}", cache_dir.display());
    }

    Ok(())
}
