use anyhow::Result;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;

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

/// Check for modpack updates
pub async fn check_for_updates(manifest_url: &str) -> Result<Manifest> {
    let response = reqwest::get(manifest_url).await?;
    let manifest: Manifest = response.json().await?;
    Ok(manifest)
}

/// Download and verify a single file
pub async fn download_file(file: &ManifestFile, base_dir: &PathBuf) -> Result<()> {
    let file_path = base_dir.join(&file.path);

    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).await?;
    }

    // Download file
    let response = reqwest::get(&file.url).await?;
    let bytes = response.bytes().await?;

    // Verify SHA256 checksum
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = format!("{:x}", hasher.finalize());

    if hash != file.sha256 {
        anyhow::bail!("Checksum mismatch for {}: expected {}, got {}", file.path, file.sha256, hash);
    }

    // Write file to disk
    let mut f = fs::File::create(&file_path).await?;
    f.write_all(&bytes).await?;

    Ok(())
}

/// Get installed modpack version
pub async fn get_installed_version(game_dir: &PathBuf) -> Result<Option<String>> {
    let version_file = game_dir.join(".wowid3-version");

    if version_file.exists() {
        let content = fs::read_to_string(version_file).await?;
        Ok(Some(content.trim().to_string()))
    } else {
        Ok(None)
    }
}

/// Update .wowid3-version file
pub async fn update_version_file(game_dir: &PathBuf, version: &str) -> Result<()> {
    let version_file = game_dir.join(".wowid3-version");
    fs::write(version_file, version).await?;
    Ok(())
}

/// Install or update modpack
pub async fn install_modpack(
    manifest: &Manifest,
    game_dir: &PathBuf,
    progress_callback: impl Fn(usize, usize),
) -> Result<()> {
    let total = manifest.files.len();

    for (index, file) in manifest.files.iter().enumerate() {
        download_file(file, game_dir).await?;
        progress_callback(index + 1, total);
    }

    update_version_file(game_dir, &manifest.version).await?;

    Ok(())
}
