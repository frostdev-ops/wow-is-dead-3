use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime};

/// CMS Configuration - matches TypeScript CMSConfig interface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CMSConfig {
    pub version: String,
    pub branding: BrandingConfig,
    pub urls: URLConfig,
    pub theme: ThemeConfig,
    pub assets: AssetsConfig,
    pub discord: DiscordConfig,
    pub localization: LocalizationConfig,
    pub defaults: DefaultsConfig,
    pub features: FeaturesConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrandingConfig {
    #[serde(rename = "appName")]
    pub app_name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    pub tagline: Option<String>,
    pub publisher: Option<String>,
    #[serde(rename = "supportUrl")]
    pub support_url: Option<String>,
    #[serde(rename = "websiteUrl")]
    pub website_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct URLConfig {
    #[serde(rename = "manifestUrl")]
    pub manifest_url: String,
    #[serde(rename = "apiBaseUrl")]
    pub api_base_url: String,
    #[serde(rename = "serverAddress")]
    pub server_address: String,
    #[serde(rename = "avatarService")]
    pub avatar_service: String,
    #[serde(rename = "microsoftClientId")]
    pub microsoft_client_id: String,
    #[serde(rename = "trackerUrl")]
    pub tracker_url: Option<String>,
    #[serde(rename = "statsUrl")]
    pub stats_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    #[serde(rename = "defaultTheme")]
    pub default_theme: String,
    pub themes: Vec<ThemeDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeDefinition {
    pub id: String,
    pub name: String,
    pub colors: HashMap<String, String>,
    pub fonts: FontConfig,
    pub animations: Option<HashMap<String, bool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontConfig {
    pub heading: String,
    pub body: String,
    pub mono: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetsConfig {
    pub logo: String,
    pub icon: String,
    pub favicon: Option<String>,
    pub backgrounds: Option<HashMap<String, String>>,
    pub audio: AudioAssets,
    pub decorations: Option<serde_json::Value>, // Flexible structure for custom decorations
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioAssets {
    #[serde(rename = "mainMusic")]
    pub main_music: String,
    #[serde(rename = "fallbackMusic")]
    pub fallback_music: String,
    #[serde(rename = "soundEffects")]
    pub sound_effects: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordConfig {
    pub enabled: bool,
    #[serde(rename = "applicationId")]
    pub application_id: String,
    pub assets: DiscordAssets,
    #[serde(rename = "defaultPresence")]
    pub default_presence: DiscordPresence,
    #[serde(rename = "partyMaxSize")]
    pub party_max_size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordAssets {
    #[serde(rename = "largeImage")]
    pub large_image: String,
    pub dimensions: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordPresence {
    pub state: String,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalizationConfig {
    #[serde(rename = "defaultLanguage")]
    pub default_language: String,
    pub languages: Vec<LanguageDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageDefinition {
    pub code: String,
    pub name: String,
    pub strings: HashMap<String, HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultsConfig {
    #[serde(rename = "minecraftVersion")]
    pub minecraft_version: String,
    #[serde(rename = "fabricEnabled")]
    pub fabric_enabled: bool,
    #[serde(rename = "fabricVersion")]
    pub fabric_version: String,
    #[serde(rename = "ramAllocation")]
    pub ram_allocation: u32,
    #[serde(rename = "minRam")]
    pub min_ram: u32,
    #[serde(rename = "maxRam")]
    pub max_ram: u32,
    #[serde(rename = "keepLauncherOpen")]
    pub keep_launcher_open: bool,
    #[serde(rename = "autoUpdate")]
    pub auto_update: bool,
    #[serde(rename = "defaultVolume")]
    pub default_volume: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeaturesConfig {
    #[serde(rename = "enableDiscord")]
    pub enable_discord: bool,
    #[serde(rename = "enableStats")]
    pub enable_stats: bool,
    #[serde(rename = "enableMapViewer")]
    pub enable_map_viewer: bool,
    #[serde(rename = "enableAutoUpdate")]
    pub enable_auto_update: bool,
    #[serde(rename = "enableCrashReporting")]
    pub enable_crash_reporting: bool,
    #[serde(rename = "enableTelemetry")]
    pub enable_telemetry: bool,
    #[serde(rename = "enableVPN")]
    pub enable_vpn: bool,
    #[serde(rename = "enableResourcePacks")]
    pub enable_resource_packs: bool,
    // Support for additional custom features
    #[serde(flatten)]
    pub custom: HashMap<String, bool>,
}

/// Cached configuration with expiry
struct CachedConfig {
    config: CMSConfig,
    fetched_at: SystemTime,
    ttl: Duration,
}

impl CachedConfig {
    fn is_expired(&self) -> bool {
        SystemTime::now()
            .duration_since(self.fetched_at)
            .map(|elapsed| elapsed > self.ttl)
            .unwrap_or(true)
    }
}

/// CMS Configuration Manager
#[derive(Clone)]
pub struct CMSConfigManager {
    cache: Arc<RwLock<Option<CachedConfig>>>,
    config_url: String,
    cache_ttl: Duration,
    fallback_config: CMSConfig,
}

impl CMSConfigManager {
    /// Create a new CMS Configuration Manager
    pub fn new(config_url: String) -> Result<Self> {
        // Load fallback configuration from embedded JSON
        let fallback_config = Self::load_fallback_config()?;

        Ok(Self {
            cache: Arc::new(RwLock::new(None)),
            config_url,
            cache_ttl: Duration::from_secs(3600), // 1 hour cache
            fallback_config,
        })
    }

    /// Load fallback configuration from embedded JSON
    fn load_fallback_config() -> Result<CMSConfig> {
        // Embed the default configuration at compile time
        const DEFAULT_CONFIG: &str = include_str!("../../cms-config.example.json");

        serde_json::from_str(DEFAULT_CONFIG)
            .map_err(|e| anyhow!("Failed to parse embedded fallback config: {}", e))
    }

    /// Fetch configuration from CMS endpoint
    pub async fn fetch_config(&self) -> Result<CMSConfig> {
        log::info!("Fetching CMS configuration from: {}", self.config_url);

        let response = reqwest::get(&self.config_url)
            .await
            .map_err(|e| anyhow!("Failed to fetch CMS config: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "CMS config fetch failed with status: {}",
                response.status()
            ));
        }

        let config: CMSConfig = response
            .json()
            .await
            .map_err(|e| anyhow!("Failed to parse CMS config JSON: {}", e))?;

        log::info!("Successfully fetched CMS configuration version {}", config.version);

        // Update cache
        if let Ok(mut cache) = self.cache.write() {
            *cache = Some(CachedConfig {
                config: config.clone(),
                fetched_at: SystemTime::now(),
                ttl: self.cache_ttl,
            });
        }

        Ok(config)
    }

    /// Get configuration (from cache if valid, otherwise fetch)
    pub async fn get_config(&self, force_refresh: bool) -> Result<CMSConfig> {
        // Check cache first (unless force refresh)
        if !force_refresh {
            if let Ok(cache) = self.cache.read() {
                if let Some(cached) = cache.as_ref() {
                    if !cached.is_expired() {
                        log::debug!("Returning cached CMS configuration");
                        return Ok(cached.config.clone());
                    }
                }
            }
        }

        // Try to fetch from CMS
        match self.fetch_config().await {
            Ok(config) => Ok(config),
            Err(e) => {
                log::warn!("Failed to fetch CMS config, using fallback: {}", e);

                // Check if we have an expired cache that we can use
                if let Ok(cache) = self.cache.read() {
                    if let Some(cached) = cache.as_ref() {
                        log::info!("Using expired cached config as fallback");
                        return Ok(cached.config.clone());
                    }
                }

                // Use embedded fallback as last resort
                log::info!("Using embedded fallback configuration");
                Ok(self.fallback_config.clone())
            }
        }
    }

    /// Get a specific section of the configuration
    pub async fn get_branding(&self) -> Result<BrandingConfig> {
        let config = self.get_config(false).await?;
        Ok(config.branding)
    }

    pub async fn get_urls(&self) -> Result<URLConfig> {
        let config = self.get_config(false).await?;
        Ok(config.urls)
    }

    pub async fn get_theme(&self) -> Result<ThemeConfig> {
        let config = self.get_config(false).await?;
        Ok(config.theme)
    }

    pub async fn get_assets(&self) -> Result<AssetsConfig> {
        let config = self.get_config(false).await?;
        Ok(config.assets)
    }

    pub async fn get_discord(&self) -> Result<DiscordConfig> {
        let config = self.get_config(false).await?;
        Ok(config.discord)
    }

    pub async fn get_localization(&self) -> Result<LocalizationConfig> {
        let config = self.get_config(false).await?;
        Ok(config.localization)
    }

    pub async fn get_defaults(&self) -> Result<DefaultsConfig> {
        let config = self.get_config(false).await?;
        Ok(config.defaults)
    }

    pub async fn get_features(&self) -> Result<FeaturesConfig> {
        let config = self.get_config(false).await?;
        Ok(config.features)
    }
}

// ==================== Tauri Commands ====================

#[tauri::command]
pub async fn cmd_get_cms_config(
    manager: tauri::State<'_, CMSConfigManager>,
    force_refresh: bool,
) -> Result<CMSConfig, String> {
    manager
        .get_config(force_refresh)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_cms_branding(
    manager: tauri::State<'_, CMSConfigManager>,
) -> Result<BrandingConfig, String> {
    manager.get_branding().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_cms_urls(
    manager: tauri::State<'_, CMSConfigManager>,
) -> Result<URLConfig, String> {
    manager.get_urls().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_cms_theme(
    manager: tauri::State<'_, CMSConfigManager>,
) -> Result<ThemeConfig, String> {
    manager.get_theme().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_cms_assets(
    manager: tauri::State<'_, CMSConfigManager>,
) -> Result<AssetsConfig, String> {
    manager.get_assets().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_cms_discord(
    manager: tauri::State<'_, CMSConfigManager>,
) -> Result<DiscordConfig, String> {
    manager.get_discord().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_cms_localization(
    manager: tauri::State<'_, CMSConfigManager>,
) -> Result<LocalizationConfig, String> {
    manager
        .get_localization()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_cms_defaults(
    manager: tauri::State<'_, CMSConfigManager>,
) -> Result<DefaultsConfig, String> {
    manager.get_defaults().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_cms_features(
    manager: tauri::State<'_, CMSConfigManager>,
) -> Result<FeaturesConfig, String> {
    manager.get_features().await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fallback_config_loads() {
        let config = CMSConfigManager::load_fallback_config();
        assert!(config.is_ok());
        let config = config.unwrap();
        assert_eq!(config.version, "1.0.0");
        assert_eq!(config.branding.app_name, "WOW Is Dead 3!");
    }

    #[tokio::test]
    async fn test_get_config_fallback() {
        // Use invalid URL to force fallback
        let manager = CMSConfigManager::new("http://invalid-url-that-does-not-exist/config.json".to_string())
            .expect("Failed to create manager");

        let config = manager.get_config(false).await;
        assert!(config.is_ok());
        let config = config.unwrap();
        assert_eq!(config.branding.app_name, "WOW Is Dead 3!");
    }
}
