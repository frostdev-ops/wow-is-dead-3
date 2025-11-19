use crate::config::Config;
use crate::models::manifest::LauncherManifest;
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

