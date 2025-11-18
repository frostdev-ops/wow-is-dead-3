use crate::config::Config;
use crate::models::Manifest;
use anyhow::{Context, Result};
use tokio::fs;
use std::path::PathBuf;

/// Read manifest for a specific version
pub async fn read_manifest(config: &Config, version: &str) -> Result<Manifest> {
    let manifest_path = config.manifest_path(version);

    if !manifest_path.exists() {
        anyhow::bail!("Manifest not found for version: {}", version);
    }

    let content = fs::read_to_string(&manifest_path)
        .await
        .context("Failed to read manifest file")?;

    let manifest: Manifest = serde_json::from_str(&content)
        .context("Failed to parse manifest JSON")?;

    Ok(manifest)
}

/// Read the latest manifest (from latest.json)
pub async fn read_latest_manifest(config: &Config) -> Result<Manifest> {
    let latest_path = config.latest_manifest_path();

    if !latest_path.exists() {
        anyhow::bail!("No latest manifest found. Create a release first.");
    }

    let content = fs::read_to_string(&latest_path)
        .await
        .context("Failed to read latest manifest")?;

    let manifest: Manifest = serde_json::from_str(&content)
        .context("Failed to parse latest manifest")?;

    // Validate manifest integrity
    validate_manifest(&manifest)?;

    Ok(manifest)
}

/// Validate manifest integrity
fn validate_manifest(manifest: &Manifest) -> Result<()> {
    // Check that manifest has a reasonable number of files
    if manifest.files.is_empty() {
        anyhow::bail!("Manifest has no files - this is likely corrupted");
    }

    // Warn if file count is suspiciously low (less than 10 is definitely wrong for a modpack)
    if manifest.files.len() < 10 {
        tracing::warn!(
            "Manifest for version {} has only {} files - this may be corrupted",
            manifest.version,
            manifest.files.len()
        );
    }

    // Validate that all files have required fields
    for (idx, file) in manifest.files.iter().enumerate() {
        if file.path.is_empty() {
            anyhow::bail!("File at index {} has empty path", idx);
        }
        if file.sha256.is_empty() {
            anyhow::bail!("File {} has empty checksum", file.path);
        }
        if file.sha256.len() != 64 {
            anyhow::bail!("File {} has invalid SHA256 checksum length: {}", file.path, file.sha256.len());
        }
        if file.url.is_empty() {
            anyhow::bail!("File {} has empty URL", file.path);
        }
    }

    Ok(())
}

/// Write manifest to disk using atomic write (temp file + rename)
pub async fn write_manifest(config: &Config, manifest: &Manifest) -> Result<()> {
    let manifest_path = config.manifest_path(&manifest.version);

    // Validate manifest before writing
    validate_manifest(manifest)?;

    // Create release directory if it doesn't exist
    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent)
            .await
            .context("Failed to create release directory")?;
    }

    // Serialize to pretty JSON
    let json = serde_json::to_string_pretty(manifest)
        .context("Failed to serialize manifest")?;

    // Atomic write: write to temp file first, then rename
    write_atomic(&manifest_path, json).await?;

    Ok(())
}

/// Atomic write: write to temp file then rename to prevent partial writes
async fn write_atomic(path: &PathBuf, content: String) -> Result<()> {
    let temp_path = path.with_extension("tmp");

    // Write to temp file
    fs::write(&temp_path, &content)
        .await
        .context("Failed to write temp file")?;

    // Rename temp file to final path (atomic on Unix)
    fs::rename(&temp_path, path)
        .await
        .context("Failed to rename temp file to final path")?;

    tracing::info!("Atomically wrote file: {}", path.display());
    Ok(())
}

/// Update the latest.json symlink/file to point to a specific version
pub async fn set_latest_manifest(config: &Config, version: &str) -> Result<()> {
    let manifest = read_manifest(config, version).await?;

    // Validate manifest before setting as latest
    validate_manifest(&manifest)?;

    let latest_path = config.latest_manifest_path();

    // Serialize to pretty JSON
    let json = serde_json::to_string_pretty(&manifest)
        .context("Failed to serialize manifest")?;

    // Atomic write to prevent partial writes
    write_atomic(&latest_path, json).await?;

    tracing::info!("Set latest manifest to version {}", version);
    Ok(())
}

/// List all available versions
pub async fn list_versions(config: &Config) -> Result<Vec<String>> {
    let releases_path = config.releases_path();

    if !releases_path.exists() {
        return Ok(Vec::new());
    }

    let mut versions = Vec::new();
    let mut entries = fs::read_dir(&releases_path)
        .await
        .context("Failed to read releases directory")?;

    while let Some(entry) = entries.next_entry().await? {
        if entry.file_type().await?.is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                versions.push(name.to_string());
            }
        }
    }

    versions.sort();
    Ok(versions)
}
