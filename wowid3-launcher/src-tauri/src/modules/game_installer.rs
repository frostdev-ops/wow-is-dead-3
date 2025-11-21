use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;

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
    pub current: u64,           // Current files downloaded
    pub total: u64,             // Total files to download
    pub current_bytes: u64,     // Current bytes downloaded
    pub total_bytes: u64,       // Total bytes to download
    pub message: String,
}

/// Install Minecraft (vanilla or Fabric)
pub async fn install_minecraft<F>(
    config: InstallConfig,
    progress_callback: F,
) -> Result<VersionMeta>
where
    F: FnMut(InstallProgress) + Send + 'static,
{
    let game_dir = &config.game_dir;
    let cache_dir = game_dir.join(".cache");

    // Wrap callback in Arc<Mutex<>> for thread-safe sharing
    let progress_callback = Arc::new(Mutex::new(progress_callback));

    // Step 0: Clean existing installation to force fresh install
    {
        let mut callback = progress_callback.lock().await;
        callback(InstallProgress {
            step: "clean".to_string(),
            current: 0,
            total: 6,
            current_bytes: 0,
            total_bytes: 0,
            message: "Cleaning existing installation...".to_string(),
        });
    }

    // Determine version ID for cleanup
    let temp_version_id = if let Some(fabric_version) = &config.fabric_version {
        format!("fabric-loader-{}-{}", fabric_version, config.game_version)
    } else {
        config.game_version.clone()
    };

    // Delete existing version directory, libraries, assets, and natives for fresh install
    let version_dir = game_dir.join("versions").join(&temp_version_id);
    if version_dir.exists() {
        tokio::fs::remove_dir_all(&version_dir).await.ok();
    }

    // Delete libraries (they'll be re-downloaded)
    let libraries_dir = game_dir.join("libraries");
    if libraries_dir.exists() {
        tokio::fs::remove_dir_all(&libraries_dir).await.ok();
    }

    // Delete assets (they'll be re-downloaded)
    let assets_dir = game_dir.join("assets");
    if assets_dir.exists() {
        tokio::fs::remove_dir_all(&assets_dir).await.ok();
    }

    // Delete natives
    let natives_dir = game_dir.join("natives");
    if natives_dir.exists() {
        tokio::fs::remove_dir_all(&natives_dir).await.ok();
    }

    // Step 1: Fetch version metadata
    {
        let mut callback = progress_callback.lock().await;
        callback(InstallProgress {
            step: "version_meta".to_string(),
            current: 1,
            total: 6,
            current_bytes: 0,
            total_bytes: 0,
            message: format!("Fetching metadata for Minecraft {}", config.game_version),
        });
    }

    let mut version_meta = get_version_meta(&config.game_version, &cache_dir).await?;

    // Step 2: Handle Fabric if requested
    if let Some(fabric_version) = &config.fabric_version {
        {
            let mut callback = progress_callback.lock().await;
            callback(InstallProgress {
                step: "fabric".to_string(),
                current: 2,
                total: 6,
                current_bytes: 0,
                total_bytes: 0,
                message: format!("Installing Fabric loader {}", fabric_version),
            });
        }

        let fabric_profile = fabric_installer::get_fabric_profile(
            &config.game_version,
            fabric_version,
            &cache_dir,
        )
        .await?;

        // Merge Fabric with vanilla
        version_meta = fabric_installer::merge_fabric_with_vanilla(&version_meta, &fabric_profile, fabric_version);

        // Download Fabric libraries
        let libraries_dir = game_dir.join("libraries");
        fabric_installer::download_fabric_libraries(&fabric_profile.libraries, &libraries_dir)
            .await?;
    }

    // Step 3: Download client JAR
    {
        let mut callback = progress_callback.lock().await;
        callback(InstallProgress {
            step: "client".to_string(),
            current: 3,
            total: 6,
            current_bytes: 0,
            total_bytes: 0,
            message: "Downloading Minecraft client".to_string(),
        });
    }

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
    {
        let mut callback = progress_callback.lock().await;
        callback(InstallProgress {
            step: "libraries".to_string(),
            current: 4,
            total: 6,
            current_bytes: 0,
            total_bytes: 0,
            message: format!("Downloading {} libraries", version_meta.libraries.len()),
        });
    }

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
    {
        let mut callback = progress_callback.lock().await;
        callback(InstallProgress {
            step: "assets".to_string(),
            current: 5,
            total: 6,
            current_bytes: 0,
            total_bytes: 0,
            message: "Downloading assets".to_string(),
        });
    }

    let assets_dir = game_dir.join("assets");
    let asset_index = asset_manager::download_asset_index(&version_meta.asset_index, &assets_dir)
        .await?;

    let progress_callback_clone = progress_callback.clone();
    asset_manager::download_all_assets(&asset_index, &assets_dir, move |current, total, current_bytes, total_bytes, msg| {
        let callback = progress_callback_clone.clone();
        tokio::spawn(async move {
            let mut cb = callback.lock().await;
            cb(InstallProgress {
                step: "assets".to_string(),
                current: current as u64,
                total: total as u64,
                current_bytes,
                total_bytes,
                message: msg,
            });
        });
    })
    .await?;

    // Step 6: Save version metadata
    let version_json_path = versions_dir.join(format!("{}.json", version_meta.id));
    let version_json = serde_json::to_string_pretty(&version_meta)?;
    tokio::fs::write(&version_json_path, version_json).await?;

    // Complete
    {
        let mut callback = progress_callback.lock().await;
        callback(InstallProgress {
            step: "complete".to_string(),
            current: 6,
            total: 6,
            current_bytes: 0,
            total_bytes: 0,
            message: "Installation complete".to_string(),
        });
    }

    Ok(version_meta)
}

/// Check if a version is installed
pub async fn is_version_installed(game_dir: &Path, version_id: &str) -> Result<bool> {
    let version_dir = game_dir.join("versions").join(version_id);
    let version_json = version_dir.join(format!("{}.json", version_id));
    let version_jar = version_dir.join(format!("{}.jar", version_id));

    eprintln!("[Game Installer] is_version_installed() checking for version: {}", version_id);
    eprintln!("[Game Installer]   game_dir: {:?}", game_dir);
    eprintln!("[Game Installer]   version_dir: {:?}", version_dir);
    eprintln!("[Game Installer]   version_json exists: {}", version_json.exists());
    eprintln!("[Game Installer]   version_jar exists: {}", version_jar.exists());

    let installed = version_json.exists() && version_jar.exists();
    eprintln!("[Game Installer]   Result: version {} is {}", version_id, if installed { "INSTALLED" } else { "NOT INSTALLED" });

    Ok(installed)
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
