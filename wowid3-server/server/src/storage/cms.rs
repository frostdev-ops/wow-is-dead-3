use crate::models::cms::{AssetCategory, AssetMetadata, CmsConfig};
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::fs;

const CMS_CONFIG_FILE: &str = "cms-config.json";

/// Load CMS configuration from disk
pub async fn load_cms_config(storage_path: &Path) -> Result<CmsConfig> {
    let config_path = storage_path.join(CMS_CONFIG_FILE);

    if !config_path.exists() {
        // Create default config if it doesn't exist
        let default_config = CmsConfig::default();
        save_cms_config(storage_path, &default_config).await?;
        return Ok(default_config);
    }

    let content = fs::read_to_string(&config_path)
        .await
        .context("Failed to read CMS config file")?;

    let config: CmsConfig = serde_json::from_str(&content)
        .context("Failed to parse CMS config JSON")?;

    Ok(config)
}

/// Save CMS configuration to disk
pub async fn save_cms_config(storage_path: &Path, config: &CmsConfig) -> Result<()> {
    let config_path = storage_path.join(CMS_CONFIG_FILE);

    let json = serde_json::to_string_pretty(config)
        .context("Failed to serialize CMS config")?;

    fs::write(&config_path, json)
        .await
        .context("Failed to write CMS config file")?;

    Ok(())
}

/// Update CMS configuration (partial update)
pub async fn update_cms_config(
    storage_path: &Path,
    updater: impl FnOnce(&mut CmsConfig),
) -> Result<CmsConfig> {
    let mut config = load_cms_config(storage_path).await?;

    // Apply updates
    updater(&mut config);

    // Update version and timestamp
    config.version += 1;
    config.updated_at = chrono::Utc::now().timestamp();

    // Save updated config
    save_cms_config(storage_path, &config).await?;

    Ok(config)
}

/// Get assets directory path
pub fn get_assets_path(storage_path: &Path) -> PathBuf {
    storage_path.join("assets")
}

/// List all assets in the assets directory
pub async fn list_assets(storage_path: &Path) -> Result<Vec<AssetMetadata>> {
    let assets_path = get_assets_path(storage_path);

    if !assets_path.exists() {
        fs::create_dir_all(&assets_path).await?;
        return Ok(Vec::new());
    }

    let mut assets = Vec::new();
    let mut entries = fs::read_dir(&assets_path).await?;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();

        if path.is_file() {
            let metadata = entry.metadata().await?;
            let filename = entry.file_name().to_string_lossy().to_string();

            // Guess MIME type from extension
            let mime_type = guess_mime_type(&filename);
            let category = AssetCategory::from_mime(&mime_type);

            assets.push(AssetMetadata {
                filename,
                size: metadata.len(),
                mime_type,
                uploaded_at: metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0),
                category,
            });
        }
    }

    // Sort by upload date (newest first)
    assets.sort_by(|a, b| b.uploaded_at.cmp(&a.uploaded_at));

    Ok(assets)
}

/// Save an asset file
pub async fn save_asset(
    storage_path: &Path,
    filename: &str,
    data: &[u8],
) -> Result<AssetMetadata> {
    let assets_path = get_assets_path(storage_path);
    fs::create_dir_all(&assets_path).await?;

    let file_path = assets_path.join(filename);
    fs::write(&file_path, data).await?;

    let mime_type = guess_mime_type(filename);
    let category = AssetCategory::from_mime(&mime_type);

    Ok(AssetMetadata {
        filename: filename.to_string(),
        size: data.len() as u64,
        mime_type,
        uploaded_at: chrono::Utc::now().timestamp(),
        category,
    })
}

/// Delete an asset file
pub async fn delete_asset(storage_path: &Path, filename: &str) -> Result<()> {
    let assets_path = get_assets_path(storage_path);
    let file_path = assets_path.join(filename);

    if file_path.exists() {
        fs::remove_file(file_path).await?;
    }

    Ok(())
}

/// Get asset file path
pub fn get_asset_file_path(storage_path: &Path, filename: &str) -> PathBuf {
    get_assets_path(storage_path).join(filename)
}

/// Guess MIME type from file extension
fn guess_mime_type(filename: &str) -> String {
    let extension = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    match extension.as_str() {
        // Audio
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "m4a" => "audio/mp4",

        // Images
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",

        // Video
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",

        // Fonts
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",

        // Default
        _ => "application/octet-stream",
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_cms_config_creation() {
        let temp_dir = TempDir::new().unwrap();
        let storage_path = temp_dir.path();

        // Load config (should create default)
        let config = load_cms_config(storage_path).await.unwrap();
        assert_eq!(config.version, 1);
        assert_eq!(config.branding.app_name, "WOWID3 Launcher");

        // Config file should exist
        assert!(storage_path.join(CMS_CONFIG_FILE).exists());
    }

    #[tokio::test]
    async fn test_cms_config_update() {
        let temp_dir = TempDir::new().unwrap();
        let storage_path = temp_dir.path();

        // Create initial config
        let initial = load_cms_config(storage_path).await.unwrap();
        assert_eq!(initial.version, 1);

        // Update config
        let updated = update_cms_config(storage_path, |config| {
            config.branding.app_name = "Custom Launcher".to_string();
        })
        .await
        .unwrap();

        assert_eq!(updated.version, 2);
        assert_eq!(updated.branding.app_name, "Custom Launcher");

        // Verify persistence
        let reloaded = load_cms_config(storage_path).await.unwrap();
        assert_eq!(reloaded.version, 2);
        assert_eq!(reloaded.branding.app_name, "Custom Launcher");
    }

    #[tokio::test]
    async fn test_asset_management() {
        let temp_dir = TempDir::new().unwrap();
        let storage_path = temp_dir.path();

        // Save asset
        let data = b"test image data";
        let metadata = save_asset(storage_path, "logo.png", data).await.unwrap();

        assert_eq!(metadata.filename, "logo.png");
        assert_eq!(metadata.size, data.len() as u64);
        assert_eq!(metadata.mime_type, "image/png");
        assert_eq!(metadata.category, AssetCategory::Image);

        // List assets
        let assets = list_assets(storage_path).await.unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].filename, "logo.png");

        // Delete asset
        delete_asset(storage_path, "logo.png").await.unwrap();
        let assets = list_assets(storage_path).await.unwrap();
        assert_eq!(assets.len(), 0);
    }

    #[test]
    fn test_mime_type_guessing() {
        assert_eq!(guess_mime_type("file.png"), "image/png");
        assert_eq!(guess_mime_type("music.mp3"), "audio/mpeg");
        assert_eq!(guess_mime_type("video.mp4"), "video/mp4");
        assert_eq!(guess_mime_type("font.woff2"), "font/woff2");
        assert_eq!(guess_mime_type("unknown.xyz"), "application/octet-stream");
    }
}
