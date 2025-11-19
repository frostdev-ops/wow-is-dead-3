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
}

impl Manifest {
    #[allow(dead_code)]
    pub fn new(
        version: String,
        minecraft_version: String,
        fabric_loader: String,
        changelog: String,
    ) -> Self {
        Self {
            version,
            minecraft_version,
            fabric_loader,
            files: Vec::new(),
            changelog,
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

/// Launcher update manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherManifest {
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
    pub changelog: String,
    pub mandatory: bool,
}
