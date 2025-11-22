use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "default_admin_password")]
    pub admin_password: String,

    #[serde(default = "default_storage_path")]
    pub storage_path: PathBuf,

    #[serde(default = "default_api_port")]
    pub api_port: u16,

    #[serde(default = "default_api_host")]
    pub api_host: String,

    #[serde(default)]
    pub cors_origin: Option<String>,

    #[serde(default = "default_base_url")]
    pub base_url: String,

    #[serde(default = "default_tracker_secret")]
    pub tracker_secret: String,
}

fn default_tracker_secret() -> String {
    "changeme".to_string()
}

fn default_admin_password() -> String {
    "changeme".to_string()
}

fn default_storage_path() -> PathBuf {
    PathBuf::from("../storage")
}

fn default_api_port() -> u16 {
    8080
}

fn default_api_host() -> String {
    "0.0.0.0".to_string()
}

fn default_base_url() -> String {
    "https://wowid-launcher.frostdev.io".to_string()
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok(); // Load .env file if it exists

        let config = envy::from_env::<Config>()?;

        // Validate admin password is set
        if config.admin_password == "changeme" {
            eprintln!("WARNING: Using default admin password. Set ADMIN_PASSWORD in .env");
        }

        if config.tracker_secret == "changeme" {
            eprintln!("WARNING: Using default tracker secret. Set TRACKER_SECRET in .env");
        }

        Ok(config)
    }

    pub fn storage_path(&self) -> &PathBuf {
        &self.storage_path
    }

    pub fn releases_path(&self) -> PathBuf {
        self.storage_path.join("releases")
    }

    pub fn uploads_path(&self) -> PathBuf {
        self.storage_path.join("uploads")
    }

    pub fn resources_path(&self) -> PathBuf {
        self.storage_path.join("resources")
    }

    pub fn blacklist_path(&self) -> PathBuf {
        self.storage_path.join("config-blacklist.txt")
    }

    pub fn latest_manifest_path(&self) -> PathBuf {
        self.storage_path.join("latest.json")
    }

    pub fn release_path(&self, version: &str) -> PathBuf {
        self.releases_path().join(version)
    }

    pub fn manifest_path(&self, version: &str) -> PathBuf {
        self.release_path(version).join("manifest.json")
    }

    pub fn launcher_path(&self) -> PathBuf {
        self.storage_path.join("launcher")
    }

    pub fn launcher_manifest_path(&self) -> PathBuf {
        self.launcher_path().join("latest.json")
    }

    // Multi-platform launcher version paths

    /// Path to version history index (launcher/versions.json)
    pub fn launcher_versions_index_path(&self) -> PathBuf {
        self.launcher_path().join("versions.json")
    }

    /// Path to a specific launcher version directory (launcher/versions/{version}/)
    pub fn launcher_version_path(&self, version: &str) -> PathBuf {
        self.launcher_path().join("versions").join(version)
    }

    /// Path to a specific version's manifest (launcher/versions/{version}/manifest.json)
    pub fn launcher_version_manifest_path(&self, version: &str) -> PathBuf {
        self.launcher_version_path(version).join("manifest.json")
    }

    /// Path to a launcher file within a version (launcher/versions/{version}/{filename})
    pub fn launcher_version_file_path(&self, version: &str, filename: &str) -> PathBuf {
        self.launcher_version_path(version).join(filename)
    }
}
