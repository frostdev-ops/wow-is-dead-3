use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use super::asset_manager;
use super::fabric_installer;
use super::library_manager;
use super::minecraft_version::{get_version_meta, VersionMeta};

/// Installation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallConfig {
    pub game_version: String,
    pub fabric_version: Option<String>,
    pub game_dir: PathBuf,
}

/// Installation progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub step: String,
    pub current: u64,
    pub total: u64,
    pub message: String,
}

/// Install Minecraft (vanilla or Fabric)
pub async fn install_minecraft<F>(
    config: InstallConfig,
    mut progress_callback: F,
) -> Result<VersionMeta>
where
    F: FnMut(InstallProgress),
{
    let game_dir = &config.game_dir;
    let cache_dir = game_dir.join(".cache");

    // Step 1: Fetch version metadata
    progress_callback(InstallProgress {
        step: "version_meta".to_string(),
        current: 0,
        total: 5,
        message: format!("Fetching metadata for Minecraft {}", config.game_version),
    });

    let mut version_meta = get_version_meta(&config.game_version, &cache_dir).await?;

    // Step 2: Handle Fabric if requested
    if let Some(fabric_version) = &config.fabric_version {
        progress_callback(InstallProgress {
            step: "fabric".to_string(),
            current: 1,
            total: 5,
            message: format!("Installing Fabric loader {}", fabric_version),
        });

        let fabric_profile = fabric_installer::get_fabric_profile(
            &config.game_version,
            fabric_version,
            &cache_dir,
        )
        .await?;

        // Merge Fabric with vanilla
        version_meta = fabric_installer::merge_fabric_with_vanilla(&version_meta, &fabric_profile);

        // Download Fabric libraries
        let libraries_dir = game_dir.join("libraries");
        fabric_installer::download_fabric_libraries(&fabric_profile.libraries, &libraries_dir)
            .await?;
    }

    // Step 3: Download client JAR
    progress_callback(InstallProgress {
        step: "client".to_string(),
        current: 2,
        total: 5,
        message: "Downloading Minecraft client".to_string(),
    });

    let versions_dir = game_dir.join("versions").join(&version_meta.id);
    tokio::fs::create_dir_all(&versions_dir).await?;

    let client_jar = versions_dir.join(format!("{}.jar", version_meta.id));
    library_manager::download_file_verified(
        &version_meta.downloads.client.url,
        &client_jar,
        Some(&version_meta.downloads.client.sha1),
    )
    .await?;

    // Step 4: Download libraries
    progress_callback(InstallProgress {
        step: "libraries".to_string(),
        current: 3,
        total: 5,
        message: format!("Downloading {} libraries", version_meta.libraries.len()),
    });

    let libraries_dir = game_dir.join("libraries");
    let features = HashMap::new(); // Default features (can be extended later)
    library_manager::download_all_libraries(&version_meta.libraries, &libraries_dir, &features)
        .await?;

    // Extract natives
    let natives_dir = game_dir.join("natives");
    library_manager::extract_natives(
        &version_meta.libraries,
        &libraries_dir,
        &natives_dir,
        &features,
    )
    .await?;

    // Step 5: Download assets
    progress_callback(InstallProgress {
        step: "assets".to_string(),
        current: 4,
        total: 5,
        message: "Downloading assets".to_string(),
    });

    let assets_dir = game_dir.join("assets");
    let asset_index = asset_manager::download_asset_index(&version_meta.asset_index, &assets_dir)
        .await?;

    asset_manager::download_all_assets(&asset_index, &assets_dir, |current, total, msg| {
        progress_callback(InstallProgress {
            step: "assets".to_string(),
            current: current as u64,
            total: total as u64,
            message: msg,
        });
    })
    .await?;

    // Step 6: Save version metadata
    let version_json_path = versions_dir.join(format!("{}.json", version_meta.id));
    let version_json = serde_json::to_string_pretty(&version_meta)?;
    tokio::fs::write(&version_json_path, version_json).await?;

    // Complete
    progress_callback(InstallProgress {
        step: "complete".to_string(),
        current: 5,
        total: 5,
        message: "Installation complete".to_string(),
    });

    Ok(version_meta)
}

/// Check if a version is installed
pub async fn is_version_installed(game_dir: &Path, version_id: &str) -> Result<bool> {
    let version_dir = game_dir.join("versions").join(version_id);
    let version_json = version_dir.join(format!("{}.json", version_id));
    let version_jar = version_dir.join(format!("{}.jar", version_id));

    Ok(version_json.exists() && version_jar.exists())
}

/// Get installed version metadata
pub async fn get_installed_version(game_dir: &Path, version_id: &str) -> Result<VersionMeta> {
    let version_json = game_dir
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));

    let content = tokio::fs::read_to_string(&version_json)
        .await
        .context("Failed to read version metadata")?;

    let meta: VersionMeta = serde_json::from_str(&content)
        .context("Failed to parse version metadata")?;

    Ok(meta)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_is_version_installed() {
        let temp_dir = TempDir::new().unwrap();
        let game_dir = temp_dir.path();

        // Not installed
        let installed = is_version_installed(game_dir, "1.20.1").await.unwrap();
        assert!(!installed);

        // Create mock installation
        let version_dir = game_dir.join("versions").join("1.20.1");
        tokio::fs::create_dir_all(&version_dir).await.unwrap();

        tokio::fs::write(
            version_dir.join("1.20.1.json"),
            r#"{"id": "1.20.1"}"#,
        )
        .await
        .unwrap();

        tokio::fs::write(version_dir.join("1.20.1.jar"), b"mock")
            .await
            .unwrap();

        // Now installed
        let installed = is_version_installed(game_dir, "1.20.1").await.unwrap();
        assert!(installed);
    }

    #[tokio::test]
    #[ignore] // Ignored by default as it downloads real files
    async fn test_install_vanilla_minecraft() {
        let temp_dir = TempDir::new().unwrap();
        let game_dir = temp_dir.path().to_path_buf();

        let config = InstallConfig {
            game_version: "1.20.1".to_string(),
            fabric_version: None,
            game_dir,
        };

        let result = install_minecraft(config, |progress| {
            println!(
                "Step: {}, {}/{} - {}",
                progress.step, progress.current, progress.total, progress.message
            );
        })
        .await;

        assert!(result.is_ok());
        let meta = result.unwrap();
        assert_eq!(meta.id, "1.20.1");
    }

    #[tokio::test]
    #[ignore] // Ignored by default as it downloads real files
    async fn test_install_fabric_minecraft() {
        let temp_dir = TempDir::new().unwrap();
        let game_dir = temp_dir.path().to_path_buf();

        // Get latest Fabric version
        let fabric_loader = fabric_installer::get_latest_fabric_loader("1.20.1")
            .await
            .unwrap();

        let config = InstallConfig {
            game_version: "1.20.1".to_string(),
            fabric_version: Some(fabric_loader.version.clone()),
            game_dir,
        };

        let result = install_minecraft(config, |progress| {
            println!(
                "Step: {}, {}/{} - {}",
                progress.step, progress.current, progress.total, progress.message
            );
        })
        .await;

        assert!(result.is_ok());
        let meta = result.unwrap();
        assert!(meta.id.contains("fabric"));
    }
}
