use crate::config::Config;
use crate::models::manifest::{LauncherManifest, LauncherVersion, LauncherVersionsIndex};
use anyhow::{Context, Result};
use tokio::fs;
use tokio::io::AsyncWriteExt;

/// Read the latest launcher manifest
pub async fn read_latest_launcher_manifest(config: &Config) -> Result<LauncherManifest> {
    let manifest_path = config.launcher_manifest_path();

    if !manifest_path.exists() {
        anyhow::bail!("No launcher manifest found");
    }

    let content = fs::read_to_string(&manifest_path)
        .await
        .context("Failed to read launcher manifest")?;

    let manifest: LauncherManifest = serde_json::from_str(&content)
        .context("Failed to parse launcher manifest")?;

    Ok(manifest)
}

/// Write launcher manifest
pub async fn write_launcher_manifest(config: &Config, manifest: &LauncherManifest) -> Result<()> {
    let manifest_path = config.launcher_manifest_path();

    // Ensure directory exists
    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent)
            .await
            .context("Failed to create launcher directory")?;
    }

    let json = serde_json::to_string_pretty(manifest)
        .context("Failed to serialize launcher manifest")?;

    // Atomic write
    let parent = manifest_path.parent().context("Invalid path")?;
    let temp_path = parent.join(format!(".tmp.launcher.{}", uuid::Uuid::new_v4()));

    let mut file = fs::File::create(&temp_path)
        .await
        .context("Failed to create temp file")?;
    
    file.write_all(json.as_bytes())
        .await
        .context("Failed to write temp file")?;
    
    file.sync_all().await.context("Failed to sync")?;
    drop(file);

    fs::rename(&temp_path, &manifest_path)
        .await
        .context("Failed to rename temp file")?;

    Ok(())
}

// Multi-platform version management functions

/// Load the versions index (list of all launcher versions)
pub async fn load_launcher_versions_index(config: &Config) -> Result<LauncherVersionsIndex> {
    let index_path = config.launcher_versions_index_path();

    if !index_path.exists() {
        // Return empty index if file doesn't exist yet
        return Ok(LauncherVersionsIndex {
            versions: vec![],
            latest: String::new(),
        });
    }

    let content = fs::read_to_string(&index_path)
        .await
        .context("Failed to read versions index")?;

    let index: LauncherVersionsIndex = serde_json::from_str(&content)
        .context("Failed to parse versions index")?;

    Ok(index)
}

/// Save the versions index
pub async fn save_launcher_versions_index(config: &Config, index: &LauncherVersionsIndex) -> Result<()> {
    let index_path = config.launcher_versions_index_path();

    // Ensure directory exists
    if let Some(parent) = index_path.parent() {
        fs::create_dir_all(parent)
            .await
            .context("Failed to create launcher directory")?;
    }

    let json = serde_json::to_string_pretty(index)
        .context("Failed to serialize versions index")?;

    // Atomic write
    let parent = index_path.parent().context("Invalid path")?;
    let temp_path = parent.join(format!(".tmp.versions.{}", uuid::Uuid::new_v4()));

    let mut file = fs::File::create(&temp_path)
        .await
        .context("Failed to create temp file")?;

    file.write_all(json.as_bytes())
        .await
        .context("Failed to write temp file")?;

    file.sync_all().await.context("Failed to sync")?;
    drop(file);

    fs::rename(&temp_path, &index_path)
        .await
        .context("Failed to rename temp file")?;

    Ok(())
}

/// Load a specific launcher version manifest
pub async fn load_launcher_version(config: &Config, version: &str) -> Result<LauncherVersion> {
    let manifest_path = config.launcher_version_manifest_path(version);

    if !manifest_path.exists() {
        anyhow::bail!("Version {} not found", version);
    }

    let content = fs::read_to_string(&manifest_path)
        .await
        .context("Failed to read version manifest")?;

    let version: LauncherVersion = serde_json::from_str(&content)
        .context("Failed to parse version manifest")?;

    Ok(version)
}

/// Save a launcher version manifest and update version index
pub async fn save_launcher_version(config: &Config, version: &LauncherVersion) -> Result<()> {
    // Create version directory
    let version_dir = config.launcher_version_path(&version.version);
    fs::create_dir_all(&version_dir)
        .await
        .context("Failed to create version directory")?;

    // Save version manifest
    let manifest_path = config.launcher_version_manifest_path(&version.version);
    let json = serde_json::to_string_pretty(version)
        .context("Failed to serialize version manifest")?;

    // Atomic write
    let temp_path = version_dir.join(format!(".tmp.manifest.{}", uuid::Uuid::new_v4()));

    let mut file = fs::File::create(&temp_path)
        .await
        .context("Failed to create temp file")?;

    file.write_all(json.as_bytes())
        .await
        .context("Failed to write temp file")?;

    file.sync_all().await.context("Failed to sync")?;
    drop(file);

    fs::rename(&temp_path, &manifest_path)
        .await
        .context("Failed to rename temp file")?;

    // Update versions index
    let mut index = load_launcher_versions_index(config).await?;

    // Add version if not already in list
    if !index.versions.contains(&version.version) {
        index.versions.insert(0, version.version.clone()); // Newest first
    }

    // Update latest
    index.latest = version.version.clone();

    save_launcher_versions_index(config, &index).await?;

    Ok(())
}

/// Delete a launcher version (manifest and all files)
pub async fn delete_launcher_version(config: &Config, version: &str) -> Result<()> {
    // Remove from versions index
    let mut index = load_launcher_versions_index(config).await?;
    index.versions.retain(|v| v != version);

    // Update latest if we're deleting the latest version
    if index.latest == version {
        index.latest = index.versions.first().cloned().unwrap_or_default();
    }

    save_launcher_versions_index(config, &index).await?;

    // Delete version directory and all files
    let version_dir = config.launcher_version_path(version);
    if version_dir.exists() {
        fs::remove_dir_all(&version_dir)
            .await
            .context("Failed to delete version directory")?;
    }

    Ok(())
}

