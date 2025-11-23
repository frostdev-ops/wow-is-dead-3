use serde::{Deserialize, Serialize};

/// Manifest file entry matching launcher format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFile {
    pub path: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
}

/// Complete manifest matching launcher format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: String,
    pub minecraft_version: String,
    pub fabric_loader: String,
    pub files: Vec<ManifestFile>,
    pub changelog: String,
    #[serde(default)]
    pub ignore_patterns: Vec<String>,
}

impl Manifest {
    #[allow(dead_code)]
    pub fn new(
        version: String,
        minecraft_version: String,
        fabric_loader: String,
        changelog: String,
        ignore_patterns: Vec<String>,
    ) -> Self {
        Self {
            version,
            minecraft_version,
            fabric_loader,
            files: Vec::new(),
            changelog,
            ignore_patterns,
        }
    }

    #[allow(dead_code)]
    pub fn add_file(&mut self, file: ManifestFile) {
        self.files.push(file);
    }

    #[allow(dead_code)]
    pub fn total_size(&self) -> u64 {
        self.files.iter().map(|f| f.size).sum()
    }
}

/// Launcher update manifest (legacy single-platform format, maintained for backward compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherManifest {
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
    pub changelog: String,
    pub mandatory: bool,
}

/// Platform-specific launcher file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherFile {
    pub platform: String,  // "windows", "linux", "macos"
    #[serde(default)]
    pub file_type: Option<String>,  // "installer" or "executable"
    pub filename: String,   // e.g., "WOWID3Launcher.exe" or "WOWID3Launcher-x86_64.AppImage"
    pub url: String,
    pub sha256: String,
    pub size: u64,
}

/// Multi-platform launcher version (new format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherVersion {
    pub version: String,
    pub files: Vec<LauncherFile>,
    pub changelog: String,
    pub mandatory: bool,
    pub released_at: String,  // ISO 8601 timestamp
}

/// Version history index (list of all available versions)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherVersionsIndex {
    pub versions: Vec<String>,  // Semantic version strings, newest first
    pub latest: String,          // Latest version number
}

impl LauncherVersion {
    /// Get file for a specific platform
    pub fn get_file_for_platform(&self, platform: &str) -> Option<&LauncherFile> {
        self.files.iter().find(|f| f.platform == platform)
    }

    /// Check if this version has a file for the given platform
    pub fn has_platform(&self, platform: &str) -> bool {
        self.files.iter().any(|f| f.platform == platform)
    }

    /// Get all available platforms for this version
    pub fn platforms(&self) -> Vec<String> {
        self.files.iter().map(|f| f.platform.clone()).collect()
    }
}
