use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Release state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReleaseState {
    Draft,
    Published,
}

/// Release metadata for admin API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Release {
    pub version: String,
    pub minecraft_version: String,
    pub fabric_loader: String,
    pub created_at: DateTime<Utc>,
    pub file_count: usize,
    pub size_bytes: u64,
    #[serde(default)]
    pub state: ReleaseState,
    #[serde(default)]
    pub is_latest: bool,
}

impl Default for ReleaseState {
    fn default() -> Self {
        ReleaseState::Draft
    }
}

/// Request to create a new release
#[derive(Debug, Clone, Deserialize)]
pub struct CreateReleaseRequest {
    pub version: String,
    pub minecraft_version: String,
    pub fabric_loader: String,
    pub changelog: String,
    pub upload_id: String, // References temp upload directory
}

/// Uploaded file metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadedFile {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}

/// Draft release metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftRelease {
    pub id: Uuid,
    pub version: String,
    pub minecraft_version: String,
    pub fabric_loader: String,
    pub changelog: String,
    pub files: Vec<DraftFile>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// File in a draft release
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftFile {
    pub path: String,
    pub url: Option<String>,
    pub sha256: String,
    pub size: u64,
}

/// Request to create a draft
#[derive(Debug, Clone, Deserialize)]
pub struct CreateDraftRequest {
    pub version: Option<String>,
    pub upload_id: Option<String>,
}

/// Request to update draft
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateDraftRequest {
    pub version: Option<String>,
    pub minecraft_version: Option<String>,
    pub fabric_loader: Option<String>,
    pub changelog: Option<String>,
}

/// Request to add files to draft
#[derive(Debug, Clone, Deserialize)]
pub struct AddFilesRequest {
    pub upload_id: String,
}

/// Request to update file metadata
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateFileRequest {
    pub sha256: Option<String>,
    pub url: Option<String>,
}

/// Version suggestions from analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionSuggestions {
    pub minecraft_version: Option<String>,
    pub fabric_loader: Option<String>,
    pub suggested_version: Option<String>,
    pub detected_mods: Vec<ModInfo>,
}

/// Detected mod information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModInfo {
    pub mod_id: String,
    pub name: String,
    pub version: String,
    pub minecraft_version: Option<String>,
    pub fabric_loader: Option<String>,
}

/// Changelog generation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedChangelog {
    pub markdown: String,
    pub added: Vec<String>,
    pub changed: Vec<String>,
    pub removed: Vec<String>,
}
