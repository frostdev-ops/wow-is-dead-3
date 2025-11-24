use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Complete CMS configuration for the launcher
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CmsConfig {
    /// Version of the CMS config (for tracking updates)
    pub version: u32,
    /// Last updated timestamp
    pub updated_at: i64,
    /// Branding configuration
    pub branding: BrandingConfig,
    /// Server connection settings
    pub server: ServerConfig,
    /// UI and theme settings
    pub ui: UiConfig,
    /// Performance and technical settings
    pub performance: PerformanceConfig,
    /// Feature flags
    pub features: FeaturesConfig,
    /// Custom assets (URLs relative to /api/cms/assets/)
    pub assets: AssetsConfig,
    /// Custom themes
    pub themes: Vec<ThemeConfig>,
}

impl Default for CmsConfig {
    fn default() -> Self {
        Self {
            version: 1,
            updated_at: chrono::Utc::now().timestamp(),
            branding: BrandingConfig::default(),
            server: ServerConfig::default(),
            ui: UiConfig::default(),
            performance: PerformanceConfig::default(),
            features: FeaturesConfig::default(),
            assets: AssetsConfig::default(),
            themes: vec![
                ThemeConfig::default_christmas(),
                ThemeConfig::default_dark(),
                ThemeConfig::default_light(),
            ],
        }
    }
}

/// Branding and visual identity
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandingConfig {
    /// Application name
    pub app_name: String,
    /// Application tagline/subtitle
    pub tagline: String,
    /// Logo URL (can be relative to assets or absolute)
    pub logo_url: Option<String>,
    /// Favicon URL
    pub favicon_url: Option<String>,
    /// Discord server invite URL
    pub discord_url: Option<String>,
    /// Website URL
    pub website_url: Option<String>,
}

impl Default for BrandingConfig {
    fn default() -> Self {
        Self {
            app_name: "WOWID3 Launcher".to_string(),
            tagline: "Modded Minecraft Made Easy".to_string(),
            logo_url: None,
            favicon_url: None,
            discord_url: Some("https://discord.gg/your-server".to_string()),
            website_url: Some("https://your-server.com".to_string()),
        }
    }
}

/// Server connection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    /// Default Minecraft server address
    pub default_server_address: String,
    /// Default manifest URL
    pub default_manifest_url: String,
    /// Minecraft version requirement
    pub minecraft_version: String,
    /// Fabric loader version requirement
    pub fabric_version: String,
    /// Whether Fabric is required
    pub fabric_required: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            default_server_address: "mc.frostdev.io:25565".to_string(),
            default_manifest_url: "https://wowid-launcher.frostdev.io/api/manifest/latest".to_string(),
            minecraft_version: "1.20.1".to_string(),
            fabric_version: "0.17.3".to_string(),
            fabric_required: true,
        }
    }
}

/// UI and theme settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiConfig {
    /// Default theme
    pub default_theme: String,
    /// Available theme names
    pub available_themes: Vec<String>,
    /// Show Discord Rich Presence toggle
    pub show_discord_toggle: bool,
    /// Show music toggle
    pub show_music_toggle: bool,
    /// Default volume (0.0 - 1.0)
    pub default_volume: f32,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            default_theme: "christmas".to_string(),
            available_themes: vec![
                "christmas".to_string(),
                "dark".to_string(),
                "light".to_string(),
            ],
            show_discord_toggle: true,
            show_music_toggle: true,
            default_volume: 0.5,
        }
    }
}

/// Performance and resource settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceConfig {
    /// Default RAM allocation in MB
    pub default_ram_mb: u32,
    /// Minimum RAM allocation in MB
    pub min_ram_mb: u32,
    /// Maximum RAM allocation in MB
    pub max_ram_mb: u32,
    /// Polling intervals in milliseconds
    pub polling_intervals: PollingIntervals,
    /// Retry configuration
    pub retry_config: RetryConfig,
    /// Download configuration
    pub download_config: DownloadConfig,
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            default_ram_mb: 16384,
            min_ram_mb: 2048,
            max_ram_mb: 32768,
            polling_intervals: PollingIntervals::default(),
            retry_config: RetryConfig::default(),
            download_config: DownloadConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollingIntervals {
    pub server_status: u32,
    pub tracker_status: u32,
    pub health_check: u32,
    pub update_check: u32,
    pub discord_reconnect: u32,
}

impl Default for PollingIntervals {
    fn default() -> Self {
        Self {
            server_status: 30000,
            tracker_status: 60000,
            health_check: 5000,
            update_check: 300000,
            discord_reconnect: 10000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub base_delay: u32,
    pub max_delay: u32,
    pub backoff_multiplier: u32,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 5,
            base_delay: 1000,
            max_delay: 60000,
            backoff_multiplier: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadConfig {
    pub max_concurrent: u32,
    pub chunk_size: u32,
    pub retry_attempts: u32,
    pub timeout: u32,
}

impl Default for DownloadConfig {
    fn default() -> Self {
        Self {
            max_concurrent: 4,
            chunk_size: 1024 * 1024,
            retry_attempts: 3,
            timeout: 30000,
        }
    }
}

/// Feature flags
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeaturesConfig {
    pub enable_discord: bool,
    pub enable_stats: bool,
    pub enable_map_viewer: bool,
    pub enable_auto_update: bool,
    pub enable_crash_reporting: bool,
    pub enable_telemetry: bool,
}

impl Default for FeaturesConfig {
    fn default() -> Self {
        Self {
            enable_discord: true,
            enable_stats: true,
            enable_map_viewer: true,
            enable_auto_update: true,
            enable_crash_reporting: false,
            enable_telemetry: false,
        }
    }
}

/// Asset URLs (relative to /api/cms/assets/)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetsConfig {
    /// Background music file
    pub menu_music: Option<String>,
    /// Fallback background music
    pub menu_music_fallback: Option<String>,
    /// Custom background images
    pub backgrounds: HashMap<String, String>,
    /// Custom logo images
    pub logos: HashMap<String, String>,
    /// Sound effects
    pub sounds: HashMap<String, String>,
}

impl Default for AssetsConfig {
    fn default() -> Self {
        Self {
            menu_music: None,
            menu_music_fallback: None,
            backgrounds: HashMap::new(),
            logos: HashMap::new(),
            sounds: HashMap::new(),
        }
    }
}

/// Theme configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    /// Theme identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Color palette
    pub colors: ThemeColors,
    /// Background settings
    pub background: ThemeBackground,
    /// Typography settings
    pub typography: ThemeTypography,
    /// Animation settings
    pub animations: ThemeAnimations,
}

impl ThemeConfig {
    pub fn default_christmas() -> Self {
        Self {
            id: "christmas".to_string(),
            name: "Christmas".to_string(),
            colors: ThemeColors {
                primary: "#ef4444".to_string(),
                secondary: "#22c55e".to_string(),
                accent: "#fbbf24".to_string(),
                background: "#0f172a".to_string(),
                surface: "#1e293b".to_string(),
                text: "#f1f5f9".to_string(),
                text_secondary: "#cbd5e1".to_string(),
                border: "#334155".to_string(),
                success: "#22c55e".to_string(),
                warning: "#f59e0b".to_string(),
                error: "#ef4444".to_string(),
                info: "#3b82f6".to_string(),
            },
            background: ThemeBackground {
                bg_type: "animated".to_string(),
                color: "#0f172a".to_string(),
                image: None,
                gradient: None,
                animation: Some("snow".to_string()),
            },
            typography: ThemeTypography::default(),
            animations: ThemeAnimations::default(),
        }
    }

    pub fn default_dark() -> Self {
        Self {
            id: "dark".to_string(),
            name: "Dark".to_string(),
            colors: ThemeColors {
                primary: "#3b82f6".to_string(),
                secondary: "#8b5cf6".to_string(),
                accent: "#06b6d4".to_string(),
                background: "#0a0a0a".to_string(),
                surface: "#1a1a1a".to_string(),
                text: "#ffffff".to_string(),
                text_secondary: "#a3a3a3".to_string(),
                border: "#262626".to_string(),
                success: "#22c55e".to_string(),
                warning: "#f59e0b".to_string(),
                error: "#ef4444".to_string(),
                info: "#3b82f6".to_string(),
            },
            background: ThemeBackground {
                bg_type: "solid".to_string(),
                color: "#0a0a0a".to_string(),
                image: None,
                gradient: None,
                animation: None,
            },
            typography: ThemeTypography::default(),
            animations: ThemeAnimations::default(),
        }
    }

    pub fn default_light() -> Self {
        Self {
            id: "light".to_string(),
            name: "Light".to_string(),
            colors: ThemeColors {
                primary: "#2563eb".to_string(),
                secondary: "#7c3aed".to_string(),
                accent: "#0891b2".to_string(),
                background: "#ffffff".to_string(),
                surface: "#f8fafc".to_string(),
                text: "#0f172a".to_string(),
                text_secondary: "#64748b".to_string(),
                border: "#e2e8f0".to_string(),
                success: "#16a34a".to_string(),
                warning: "#ea580c".to_string(),
                error: "#dc2626".to_string(),
                info: "#2563eb".to_string(),
            },
            background: ThemeBackground {
                bg_type: "solid".to_string(),
                color: "#ffffff".to_string(),
                image: None,
                gradient: None,
                animation: None,
            },
            typography: ThemeTypography::default(),
            animations: ThemeAnimations::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeColors {
    pub primary: String,
    pub secondary: String,
    pub accent: String,
    pub background: String,
    pub surface: String,
    pub text: String,
    pub text_secondary: String,
    pub border: String,
    pub success: String,
    pub warning: String,
    pub error: String,
    pub info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeBackground {
    #[serde(rename = "type")]
    pub bg_type: String, // "solid", "gradient", "image", "animated"
    pub color: String,
    pub image: Option<String>,
    pub gradient: Option<String>,
    pub animation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeTypography {
    pub font_family: String,
    pub heading_font: String,
    pub font_size_base: String,
    pub font_weight_normal: u16,
    pub font_weight_bold: u16,
}

impl Default for ThemeTypography {
    fn default() -> Self {
        Self {
            font_family: "Inter, system-ui, -apple-system, sans-serif".to_string(),
            heading_font: "Inter, system-ui, -apple-system, sans-serif".to_string(),
            font_size_base: "16px".to_string(),
            font_weight_normal: 400,
            font_weight_bold: 600,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeAnimations {
    pub enable_animations: bool,
    pub transition_speed: String,
    pub animation_timing: String,
}

impl Default for ThemeAnimations {
    fn default() -> Self {
        Self {
            enable_animations: true,
            transition_speed: "300ms".to_string(),
            animation_timing: "ease-in-out".to_string(),
        }
    }
}

/// Request to update CMS configuration
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCmsConfigRequest {
    pub branding: Option<BrandingConfig>,
    pub server: Option<ServerConfig>,
    pub ui: Option<UiConfig>,
    pub performance: Option<PerformanceConfig>,
    pub features: Option<FeaturesConfig>,
    pub assets: Option<AssetsConfig>,
    pub themes: Option<Vec<ThemeConfig>>,
}

/// Asset file metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetMetadata {
    pub filename: String,
    pub size: u64,
    pub mime_type: String,
    pub uploaded_at: i64,
    pub category: AssetCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AssetCategory {
    Audio,
    Image,
    Video,
    Font,
    Other,
}

impl AssetCategory {
    pub fn from_mime(mime: &str) -> Self {
        if mime.starts_with("audio/") {
            Self::Audio
        } else if mime.starts_with("image/") {
            Self::Image
        } else if mime.starts_with("video/") {
            Self::Video
        } else if mime.starts_with("font/") || mime == "application/font-woff" || mime == "application/font-woff2" {
            Self::Font
        } else {
            Self::Other
        }
    }
}

/// Response for asset upload
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetUploadResponse {
    pub filename: String,
    pub url: String,
    pub metadata: AssetMetadata,
}

/// Response for listing assets
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAssetsResponse {
    pub assets: Vec<AssetMetadata>,
}
