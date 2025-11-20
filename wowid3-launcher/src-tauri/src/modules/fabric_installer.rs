use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

use super::minecraft_version::{Library, VersionMeta};

const FABRIC_META_URL: &str = "https://meta.fabricmc.net";
const FABRIC_MAVEN_URL: &str = "https://maven.fabricmc.net";

/// Fabric loader version information (top-level response from API)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricLoaderResponse {
    pub loader: FabricLoader,
}

/// Fabric loader details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricLoader {
    #[serde(default)]
    pub separator: Option<String>,
    pub build: i32,
    pub maven: String,
    pub version: String,
    pub stable: bool,
}

/// Combined Fabric profile (from /profile/json endpoint)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FabricProfile {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub inherits_from: String,
    pub main_class: String,
    pub arguments: Option<super::minecraft_version::Arguments>,
    pub libraries: Vec<Library>,
}

/// Get all available Fabric loader versions for a game version
pub async fn get_fabric_loaders(game_version: &str) -> Result<Vec<FabricLoader>> {
    let url = format!("{}/v2/versions/loader/{}", FABRIC_META_URL, game_version);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let response = client
        .get(&url)
        .send()
        .await
        .context("Failed to fetch Fabric loader versions")?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Failed to fetch Fabric loaders: HTTP {}",
            response.status()
        ));
    }

    let loader_responses: Vec<FabricLoaderResponse> = response
        .json()
        .await
        .context("Failed to parse Fabric loader JSON")?;

    // Extract just the loader info from each response
    let loaders = loader_responses.into_iter().map(|r| r.loader).collect();

    Ok(loaders)
}

/// Get the latest stable Fabric loader for a game version
pub async fn get_latest_fabric_loader(game_version: &str) -> Result<FabricLoader> {
    let loaders = get_fabric_loaders(game_version).await?;

    loaders
        .into_iter()
        .find(|l| l.stable)
        .ok_or_else(|| anyhow::anyhow!("No stable Fabric loader found for {}", game_version))
}

/// Get Fabric profile (combined metadata)
pub async fn get_fabric_profile(
    game_version: &str,
    loader_version: &str,
    cache_dir: &Path,
) -> Result<FabricProfile> {
    let cache_file = cache_dir
        .join("fabric")
        .join(format!("{}-{}.json", game_version, loader_version));

    // Try cache first
    if cache_file.exists() {
        if let Ok(content) = tokio::fs::read_to_string(&cache_file).await {
            if let Ok(profile) = serde_json::from_str::<FabricProfile>(&content) {
                return Ok(profile);
            }
        }
    }

    // Download from Fabric Meta API
    let url = format!(
        "{}/v2/versions/loader/{}/{}/profile/json",
        FABRIC_META_URL, game_version, loader_version
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let response = client
        .get(&url)
        .send()
        .await
        .context("Failed to fetch Fabric profile")?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Failed to fetch Fabric profile: HTTP {}",
            response.status()
        ));
    }

    let profile: FabricProfile = response
        .json()
        .await
        .context("Failed to parse Fabric profile JSON")?;

    // Cache it
    tokio::fs::create_dir_all(cache_file.parent().unwrap()).await?;
    let json = serde_json::to_string_pretty(&profile)?;
    tokio::fs::write(&cache_file, json).await?;

    Ok(profile)
}

/// Merge Fabric metadata with vanilla version metadata
pub fn merge_fabric_with_vanilla(
    vanilla_meta: &VersionMeta,
    fabric_profile: &FabricProfile,
    loader_version: &str,
) -> VersionMeta {
    let mut merged = vanilla_meta.clone();

    // Override main class with Fabric's
    merged.main_class = fabric_profile.main_class.clone();

    // Add Fabric libraries (prepend so they take precedence)
    let mut all_libraries = fabric_profile.libraries.clone();
    all_libraries.extend(vanilla_meta.libraries.clone());
    merged.libraries = all_libraries;

    // Merge arguments if present
    if let Some(fabric_args) = &fabric_profile.arguments {
        if let Some(vanilla_args) = &mut merged.arguments {
            // Prepend Fabric's game arguments
            let mut all_game_args = fabric_args.game.clone();
            all_game_args.extend(vanilla_args.game.clone());
            vanilla_args.game = all_game_args;

            // Prepend Fabric's JVM arguments
            let mut all_jvm_args = fabric_args.jvm.clone();
            all_jvm_args.extend(vanilla_args.jvm.clone());
            vanilla_args.jvm = all_jvm_args;
        } else {
            merged.arguments = Some(fabric_args.clone());
        }
    }

    // Update version ID to indicate Fabric
    // Format: fabric-loader-{loader_version}-{minecraft_version}
    // Example: fabric-loader-0.17.3-1.20.1
    merged.id = format!("fabric-loader-{}-{}", loader_version, vanilla_meta.id);

    merged
}

/// Download Fabric libraries (similar to vanilla libraries but from Fabric Maven)
pub async fn download_fabric_libraries(
    libraries: &[Library],
    libraries_dir: &Path,
) -> Result<()> {
    use super::library_manager::download_file_verified;

    for library in libraries {
        // Check if this is a Fabric library (from maven.fabricmc.net)
        if let Some(downloads) = &library.downloads {
            if let Some(artifact) = &downloads.artifact {
                // Only download if URL is from Fabric Maven
                if artifact.url.contains("maven.fabricmc.net") || artifact.url.contains("maven.quiltmc.org") {
                    let dest = libraries_dir.join(&artifact.path);
                    download_file_verified(&artifact.url, &dest, Some(&artifact.sha1)).await?;
                }
            }
        } else {
            // Legacy format: construct URL from Maven coordinates
            let path = super::library_manager::maven_to_path(&library.name);
            let url = format!("{}/{}", FABRIC_MAVEN_URL, path);
            let dest = libraries_dir.join(&path);

            // Try to download (may fail for non-Fabric libraries)
            if let Err(e) = download_file_verified(&url, &dest, None).await {
                eprintln!("Failed to download Fabric library {}: {}", library.name, e);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_fabric_loaders() {
        let loaders = get_fabric_loaders("1.20.1").await;
        if let Err(e) = &loaders {
            eprintln!("Error: {}", e);
        }
        assert!(loaders.is_ok(), "Failed to get Fabric loaders: {:?}", loaders.err());

        let loaders = loaders.unwrap();
        assert!(!loaders.is_empty());

        // Check that at least one is stable
        let has_stable = loaders.iter().any(|l| l.stable);
        assert!(has_stable);
    }

    #[tokio::test]
    async fn test_get_latest_fabric_loader() {
        let loader = get_latest_fabric_loader("1.20.1").await;
        assert!(loader.is_ok());

        let loader = loader.unwrap();
        assert!(loader.stable);
        assert!(!loader.version.is_empty());
    }

    #[tokio::test]
    async fn test_get_fabric_profile() {
        use tempfile::TempDir;

        let temp_dir = TempDir::new().unwrap();
        let cache_dir = temp_dir.path();

        // Get latest loader first
        let loader = get_latest_fabric_loader("1.20.1").await.unwrap();

        // Get profile
        let profile = get_fabric_profile("1.20.1", &loader.version, cache_dir).await;
        assert!(profile.is_ok());

        let profile = profile.unwrap();
        assert_eq!(profile.inherits_from, "1.20.1");
        assert!(!profile.libraries.is_empty());
        assert!(profile.main_class.contains("fabric"));
    }
}
