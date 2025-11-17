use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Release metadata for admin API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Release {
    pub version: String,
    pub minecraft_version: String,
    pub fabric_loader: String,
    pub created_at: DateTime<Utc>,
    pub file_count: usize,
    pub size_bytes: u64,
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
