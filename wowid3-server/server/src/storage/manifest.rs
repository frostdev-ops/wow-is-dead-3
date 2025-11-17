use crate::config::Config;
use crate::models::{Manifest, ManifestFile};
use anyhow::{Context, Result};
use std::path::PathBuf;
use tokio::fs;

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

    Ok(manifest)
}

/// Write manifest to disk
pub async fn write_manifest(config: &Config, manifest: &Manifest) -> Result<()> {
    let manifest_path = config.manifest_path(&manifest.version);

    // Create release directory if it doesn't exist
    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent)
            .await
            .context("Failed to create release directory")?;
    }

    // Serialize to pretty JSON
    let json = serde_json::to_string_pretty(manifest)
        .context("Failed to serialize manifest")?;

    // Write to file
    fs::write(&manifest_path, json)
        .await
        .context("Failed to write manifest file")?;

    Ok(())
}

/// Update the latest.json symlink/file to point to a specific version
pub async fn set_latest_manifest(config: &Config, version: &str) -> Result<()> {
    let manifest = read_manifest(config, version).await?;
    let latest_path = config.latest_manifest_path();

    // Write the manifest as latest.json (we use copy instead of symlink for simplicity)
    let json = serde_json::to_string_pretty(&manifest)
        .context("Failed to serialize manifest")?;

    fs::write(&latest_path, json)
        .await
        .context("Failed to write latest manifest")?;

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
