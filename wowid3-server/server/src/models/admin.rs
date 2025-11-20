use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadResponse {
    pub upload_id: String,
    pub file_name: String,
    pub file_size: u64,
    pub sha256: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlacklistResponse {
    pub patterns: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateBlacklistRequest {
    pub patterns: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReleaseInfo {
    pub version: String,
    pub minecraft_version: String,
    pub created_at: String,
    pub file_count: usize,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteReleaseResponse {
    pub message: String,
    pub deleted_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdminError {
    pub error: String,
}
