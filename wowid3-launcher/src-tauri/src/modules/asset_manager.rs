use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

use super::download_manager::{DownloadManager, DownloadPriority, DownloadTask, HashType};
use super::minecraft_version::AssetIndex as AssetIndexMeta;

const ASSETS_BASE_URL: &str = "https://resources.download.minecraft.net";

/// Asset index containing all asset objects
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetIndex {
    pub objects: HashMap<String, AssetObject>,
}

/// Individual asset object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

/// Download and parse asset index
pub async fn download_asset_index(
    asset_index_meta: &AssetIndexMeta,
    assets_dir: &Path,
) -> Result<AssetIndex> {
    let index_dir = assets_dir.join("indexes");
    tokio::fs::create_dir_all(&index_dir).await?;

    let index_file = index_dir.join(format!("{}.json", asset_index_meta.id));

    // Check if index exists and is valid
    if index_file.exists() {
        if let Ok(content) = tokio::fs::read_to_string(&index_file).await {
            if let Ok(index) = serde_json::from_str::<AssetIndex>(&content) {
                // Verify SHA1
                if verify_sha1_string(&content, &asset_index_meta.sha1) {
                    return Ok(index);
                }
            }
        }
    }

    // Download asset index
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()?;

    let response = client
        .get(&asset_index_meta.url)
        .send()
        .await
        .context("Failed to download asset index")?;

    let content = response.text().await?;

    // Verify SHA1
    if !verify_sha1_string(&content, &asset_index_meta.sha1) {
        return Err(anyhow::anyhow!("Asset index SHA1 mismatch"));
    }

    // Parse JSON
    let index: AssetIndex = serde_json::from_str(&content)
        .context("Failed to parse asset index JSON")?;

    // Save to file
    tokio::fs::write(&index_file, &content).await?;

    Ok(index)
}

/// Verify SHA1 hash of a string
fn verify_sha1_string(content: &str, expected: &str) -> bool {
    let mut hasher = Sha1::new();
    hasher.update(content.as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    hash == expected
}

/// Download a single asset
async fn download_asset(
    asset_object: &AssetObject,
    assets_dir: &Path,
) -> Result<()> {
    let hash = &asset_object.hash;

    // Assets are stored in subdirectories based on first 2 characters of hash
    let subdir = &hash[0..2];
    let object_dir = assets_dir.join("objects").join(subdir);
    tokio::fs::create_dir_all(&object_dir).await?;

    let dest = object_dir.join(hash);

    // Skip if file exists and hash matches
    if dest.exists() {
        if let Ok(bytes) = tokio::fs::read(&dest).await {
            if verify_sha1_bytes(&bytes, hash) {
                return Ok(());
            }
        }
    }

    // Download asset
    let url = format!("{}/{}/{}", ASSETS_BASE_URL, subdir, hash);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()?;

    let response = client
        .get(&url)
        .send()
        .await
        .context(format!("Failed to download asset {}", hash))?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Failed to download asset {}: HTTP {}",
            hash,
            response.status()
        ));
    }

    let bytes = response.bytes().await?;

    // Verify SHA1
    if !verify_sha1_bytes(&bytes, hash) {
        return Err(anyhow::anyhow!(
            "Asset SHA1 mismatch: expected {}, got different hash",
            hash
        ));
    }

    // Write file
    let mut file = tokio::fs::File::create(&dest).await?;
    file.write_all(&bytes).await?;

    Ok(())
}

/// Verify SHA1 hash of bytes
fn verify_sha1_bytes(bytes: &[u8], expected: &str) -> bool {
    let mut hasher = Sha1::new();
    hasher.update(bytes);
    let hash = format!("{:x}", hasher.finalize());
    hash == expected
}

/// Download all assets with progress reporting using DownloadManager
pub async fn download_all_assets<F>(
    asset_index: &AssetIndex,
    assets_dir: &Path,
    progress_callback: F,
) -> Result<()>
where
    F: FnMut(usize, usize, u64, u64, String) + Send + 'static,
{
    tokio::fs::create_dir_all(assets_dir.join("objects")).await?;

    let total = asset_index.objects.len();
    let total_bytes: u64 = asset_index.objects.values().map(|obj| obj.size).sum();

    // Collect all download tasks, filtering out already-downloaded assets
    let mut download_tasks = Vec::new();
    let assets_dir_path = assets_dir.to_path_buf();

    for asset_object in asset_index.objects.values() {
        let hash = &asset_object.hash;
        let subdir = &hash[0..2];
        let object_dir = assets_dir_path.join("objects").join(subdir);
        let dest = object_dir.join(hash);

        // Skip if file exists and hash matches
        if dest.exists() {
            if let Ok(bytes) = tokio::fs::read(&dest).await {
                if verify_sha1_bytes(&bytes, hash) {
                    continue;
                }
            }
        }

        // Create subdirectory
        tokio::fs::create_dir_all(&object_dir).await?;

        let url = format!("{}/{}/{}", ASSETS_BASE_URL, subdir, hash);
        download_tasks.push(DownloadTask {
            url,
            dest,
            expected_hash: HashType::Sha1(hash.clone()),
            priority: DownloadPriority::Medium,
            size: asset_object.size,
        });
    }

    if download_tasks.is_empty() {
        return Ok(());
    }

    // Track progress across all parallel downloads
    let (progress_tx, mut progress_rx) =
        tokio::sync::mpsc::channel::<super::download_manager::DownloadProgress>(1000);
    let completed = Arc::new(Mutex::new(0usize));
    let completed_bytes = Arc::new(Mutex::new(0u64));

    // Wrap callback in Arc<Mutex<>> to make it thread-safe
    let callback_mutex = Arc::new(Mutex::new(progress_callback));

    // Spawn progress tracking task
    let completed_clone = completed.clone();
    let completed_bytes_clone = completed_bytes.clone();
    let callback_clone = callback_mutex.clone();
    let progress_task = tokio::spawn(async move {
        while let Some(progress) = progress_rx.recv().await {
            if progress.completed {
                let mut comp = completed_clone.lock().await;
                *comp += 1;
                let mut bytes = completed_bytes_clone.lock().await;
                *bytes += progress.total_bytes;
                let current_completed = *comp;
                let current_bytes = *bytes;
                drop(comp);
                drop(bytes);

                let mut callback = callback_clone.lock().await;
                callback(
                    current_completed,
                    total,
                    current_bytes,
                    total_bytes,
                    "Downloading assets".to_string(),
                );
            }
        }
    });

    // Download all files in parallel using DownloadManager with higher concurrency
    let concurrency = super::download_manager::calculate_optimal_concurrency();
    let manager = DownloadManager::new(concurrency, 3)?;
    manager
        .download_files(download_tasks, Some(progress_tx))
        .await
        .context("Failed to download assets")?;

    // Wait for progress tracking to complete
    progress_task.await?;

    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_sha1_string() {
        let content = "Hello, World!";
        let hash = "0a0a9f2a6772942557ab5355d76af442f8f65e01";
        assert!(verify_sha1_string(content, hash));
    }

    #[test]
    fn test_verify_sha1_bytes() {
        let content = b"Hello, World!";
        let hash = "0a0a9f2a6772942557ab5355d76af442f8f65e01";
        assert!(verify_sha1_bytes(content, hash));
    }

    #[tokio::test]
    async fn test_asset_index_parse() {
        let json = r#"{
            "objects": {
                "minecraft/sounds/ambient/cave/cave1.ogg": {
                    "hash": "3a5a1e1d1a1e1f1c1d1e1f1a1b1c1d1e1f1a1b1c",
                    "size": 123456
                }
            }
        }"#;

        let index: AssetIndex = serde_json::from_str(json).unwrap();
        assert_eq!(index.objects.len(), 1);

        let obj = index.objects.get("minecraft/sounds/ambient/cave/cave1.ogg").unwrap();
        assert_eq!(obj.size, 123456);
    }
}
