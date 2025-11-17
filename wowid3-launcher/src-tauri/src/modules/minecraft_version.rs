use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

const VERSION_MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

/// Version manifest containing all Minecraft versions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: Latest,
    pub versions: Vec<VersionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Latest {
    pub release: String,
    pub snapshot: String,
}

/// Information about a specific Minecraft version
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String, // "release" or "snapshot"
    pub url: String,
    pub time: String,
    pub release_time: String,
}

/// Complete version metadata (downloaded from version.url)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionMeta {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub main_class: String,
    pub arguments: Option<Arguments>,
    pub minecraft_arguments: Option<String>, // Legacy format (pre-1.13)
    pub libraries: Vec<Library>,
    pub downloads: Downloads,
    pub asset_index: AssetIndex,
    pub assets: String,
    pub java_version: Option<JavaVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Arguments {
    pub game: Vec<Argument>,
    pub jvm: Vec<Argument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Argument {
    String(String),
    Object {
        rules: Vec<Rule>,
        value: ArgumentValue,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ArgumentValue {
    String(String),
    Array(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub action: String, // "allow" or "disallow"
    pub os: Option<OsRule>,
    pub features: Option<HashMap<String, bool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsRule {
    pub name: Option<String>, // "windows", "linux", "osx"
    pub version: Option<String>,
    pub arch: Option<String>, // "x86" or "x86_64"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Library {
    pub name: String, // Maven coordinates (e.g., "com.mojang:logging:1.0.0")
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Rule>>,
    pub natives: Option<HashMap<String, String>>,
    pub extract: Option<Extract>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<Artifact>,
    pub classifiers: Option<HashMap<String, Artifact>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extract {
    pub exclude: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Downloads {
    pub client: DownloadInfo,
    pub server: Option<DownloadInfo>,
    pub client_mappings: Option<DownloadInfo>,
    pub server_mappings: Option<DownloadInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadInfo {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersion {
    pub component: String,
    pub major_version: i32,
}

/// Fetch the version manifest from Mojang
pub async fn fetch_version_manifest() -> Result<VersionManifest> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let response = client
        .get(VERSION_MANIFEST_URL)
        .send()
        .await
        .context("Failed to fetch version manifest")?;

    let manifest: VersionManifest = response
        .json()
        .await
        .context("Failed to parse version manifest JSON")?;

    Ok(manifest)
}

/// Fetch version metadata from cache or download
pub async fn get_version_meta(version_id: &str, cache_dir: &Path) -> Result<VersionMeta> {
    let cache_file = cache_dir
        .join("versions")
        .join(format!("{}.json", version_id));

    // Try to load from cache first
    if cache_file.exists() {
        let content = tokio::fs::read_to_string(&cache_file)
            .await
            .context("Failed to read cached version metadata")?;

        if let Ok(meta) = serde_json::from_str::<VersionMeta>(&content) {
            return Ok(meta);
        }
    }

    // Not in cache or corrupted, fetch from manifest
    let manifest = fetch_version_manifest().await?;

    let version_info = manifest
        .versions
        .iter()
        .find(|v| v.id == version_id)
        .ok_or_else(|| anyhow::anyhow!("Version {} not found in manifest", version_id))?;

    // Download version metadata
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let response = client
        .get(&version_info.url)
        .send()
        .await
        .context("Failed to fetch version metadata")?;

    let meta: VersionMeta = response
        .json()
        .await
        .context("Failed to parse version metadata JSON")?;

    // Cache it
    tokio::fs::create_dir_all(cache_file.parent().unwrap()).await?;
    let json = serde_json::to_string_pretty(&meta)?;
    tokio::fs::write(&cache_file, json).await?;

    Ok(meta)
}

/// Get all available versions (optionally filtered by type)
pub async fn list_versions(version_type: Option<&str>) -> Result<Vec<VersionInfo>> {
    let manifest = fetch_version_manifest().await?;

    if let Some(filter_type) = version_type {
        Ok(manifest
            .versions
            .into_iter()
            .filter(|v| v.version_type == filter_type)
            .collect())
    } else {
        Ok(manifest.versions)
    }
}

/// Get the latest release version
pub async fn get_latest_release() -> Result<String> {
    let manifest = fetch_version_manifest().await?;
    Ok(manifest.latest.release)
}

/// Get the latest snapshot version
pub async fn get_latest_snapshot() -> Result<String> {
    let manifest = fetch_version_manifest().await?;
    Ok(manifest.latest.snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_fetch_version_manifest() {
        let manifest = fetch_version_manifest().await;
        assert!(manifest.is_ok());

        let manifest = manifest.unwrap();
        assert!(!manifest.versions.is_empty());
        assert!(!manifest.latest.release.is_empty());
    }

    #[tokio::test]
    async fn test_get_latest_release() {
        let latest = get_latest_release().await;
        assert!(latest.is_ok());

        let version = latest.unwrap();
        assert!(!version.is_empty());
        println!("Latest release: {}", version);
    }

    #[tokio::test]
    async fn test_list_versions() {
        let versions = list_versions(Some("release")).await;
        assert!(versions.is_ok());

        let versions = versions.unwrap();
        assert!(!versions.is_empty());

        // All should be releases
        for v in &versions {
            assert_eq!(v.version_type, "release");
        }
    }

    #[tokio::test]
    async fn test_get_version_meta() {
        let temp_dir = TempDir::new().unwrap();
        let cache_dir = temp_dir.path();

        // Fetch metadata for 1.20.1
        let meta = get_version_meta("1.20.1", cache_dir).await;
        assert!(meta.is_ok());

        let meta = meta.unwrap();
        assert_eq!(meta.id, "1.20.1");
        assert!(!meta.main_class.is_empty());
        assert!(!meta.libraries.is_empty());

        // Verify cache file was created
        let cache_file = cache_dir.join("versions").join("1.20.1.json");
        assert!(cache_file.exists());

        // Fetch again (should use cache)
        let meta2 = get_version_meta("1.20.1", cache_dir).await;
        assert!(meta2.is_ok());
    }
}
