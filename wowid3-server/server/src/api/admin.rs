use crate::config::Config;
use crate::middleware::AdminToken;
use crate::models::{
    AdminError, BlacklistResponse, CreateReleaseRequest, DeleteReleaseResponse, LoginRequest,
    LoginResponse, Manifest, ManifestFile, ReleaseInfo, ReleaseListResponse,
    UpdateBlacklistRequest, UploadResponse,
};
use crate::storage;
use axum::{
    extract::{multipart::Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Utc;
use serde_json::json;
use sha2::Digest;
use std::sync::Arc;
use tokio::fs;
use uuid::Uuid;

#[derive(Clone)]
pub struct AdminState {
    pub config: Arc<Config>,
    pub admin_password: Arc<String>,
}

/// POST /api/admin/login - Authenticate and get token
pub async fn login(
    State(state): State<AdminState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    if request.password == *state.admin_password {
        // Simple token is the password hash (in production, use proper JWT)
        let mut hasher = sha2::Sha256::new();
        hasher.update(request.password.as_bytes());
        let token = format!("{:x}", hasher.finalize());
        Ok(Json(LoginResponse {
            token,
            message: "Login successful".to_string(),
        }))
    } else {
        Err(AppError::Unauthorized("Invalid password".to_string()))
    }
}

/// POST /api/admin/upload - Upload modpack files
pub async fn upload_files(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    mut multipart: Multipart,
) -> Result<Json<Vec<UploadResponse>>, AppError> {
    let upload_id = Uuid::new_v4().to_string();
    let upload_dir = state.config.uploads_path().join(&upload_id);
    fs::create_dir_all(&upload_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create upload directory: {}", e)))?;

    let mut responses = Vec::new();
    let mut multipart = multipart;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Multipart error: {}", e)))?
    {
        let file_name = field
            .file_name()
            .ok_or_else(|| AppError::BadRequest("Missing file name".to_string()))?
            .to_string();

        // Create nested directory structure if the file is in subdirectories
        let file_path = upload_dir.join(&file_name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create subdirectory: {}", e)))?;
        }

        // Read file data
        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read file data: {}", e)))?;

        let file_size = data.len() as u64;

        // Calculate SHA256
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(&data);
        let sha256 = format!("{:x}", hasher.finalize());

        // Write file
        fs::write(&file_path, &data)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write file: {}", e)))?;

        responses.push(UploadResponse {
            upload_id: upload_id.clone(),
            file_name,
            file_size,
            sha256,
            message: "File uploaded successfully".to_string(),
        });
    }

    Ok(Json(responses))
}

/// POST /api/admin/releases - Create a new release from uploaded files
pub async fn create_release(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Json(request): Json<CreateReleaseRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Get upload directory
    let upload_dir = state.config.uploads_path().join(&request.upload_id);

    // Verify upload exists
    if !upload_dir.exists() {
        return Err(AppError::NotFound(format!(
            "Upload {} not found",
            request.upload_id
        )));
    }

    // Create release directory
    let release_dir = state.config.release_path(&request.version);
    if release_dir.exists() {
        return Err(AppError::BadRequest(format!(
            "Release version {} already exists",
            request.version
        )));
    }

    fs::create_dir_all(&release_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create release directory: {}", e)))?;

    // Walk uploaded files and create manifest
    let mut files = Vec::new();
    let mut total_size = 0u64;

    for entry in walkdir::WalkDir::new(&upload_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let file_path = entry.path();
        let relative_path = file_path
            .strip_prefix(&upload_dir)
            .map_err(|_| AppError::Internal(anyhow::anyhow!("Path error")))?;

        // Copy file to release directory
        let target_path = release_dir.join(relative_path);
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e)))?;
        }

        fs::copy(file_path, &target_path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to copy file: {}", e)))?;

        // Calculate checksum
        let sha256 = storage::files::calculate_checksum(&target_path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to calculate checksum: {}", e)))?;

        let file_size = fs::metadata(&target_path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to get file size: {}", e)))?
            .len();

        total_size += file_size;

        let relative_str = relative_path
            .to_string_lossy()
            .replace("\\", "/");

        files.push(ManifestFile {
            path: relative_str,
            url: format!(
                "{}/files/{}/{}",
                state.config.base_url, request.version, relative_path.to_string_lossy()
            ),
            sha256,
            size: file_size,
        });
    }

    // Create manifest
    let changelog_preview = request.changelog.chars().take(100).collect::<String>();
    let manifest = Manifest {
        version: request.version.clone(),
        minecraft_version: request.minecraft_version,
        fabric_loader: request.fabric_loader,
        files,
        changelog: request.changelog,
    };

    // Write manifest
    storage::manifest::write_manifest(&state.config, &manifest)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write manifest: {}", e)))?;

    // Update latest manifest
    storage::manifest::set_latest_manifest(&state.config, &request.version)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to update latest manifest: {}", e)))?;

    // Clean up upload directory
    fs::remove_dir_all(&upload_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to clean up uploads: {}", e)))?;

    Ok(Json(json!({
        "message": "Release created successfully",
        "version": request.version,
        "file_count": manifest.files.len(),
        "size_bytes": total_size,
        "changelog_preview": changelog_preview
    })))
}

/// GET /api/admin/releases - List all releases
pub async fn list_releases(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
) -> Result<Json<ReleaseListResponse>, AppError> {
    let versions = storage::manifest::list_versions(&state.config)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to list versions: {}", e)))?;

    let mut releases = Vec::new();

    for version in versions {
        match storage::manifest::read_manifest(&state.config, &version).await {
            Ok(manifest) => {
                let release_dir = state.config.release_path(&version);
                let mut total_size = 0u64;
                let mut file_count = 0;

                for entry in walkdir::WalkDir::new(&release_dir)
                    .into_iter()
                    .filter_map(|e| e.ok())
                    .filter(|e| e.file_type().is_file())
                {
                    if let Ok(metadata) = fs::metadata(entry.path()).await {
                        total_size += metadata.len();
                        file_count += 1;
                    }
                }

                releases.push(ReleaseInfo {
                    version: manifest.version,
                    minecraft_version: manifest.minecraft_version,
                    created_at: Utc::now().to_rfc3339(),
                    file_count,
                    size_bytes: total_size,
                });
            }
            Err(_) => continue, // Skip failed reads
        }
    }

    // Sort by version (newest first)
    releases.sort_by(|a, b| b.version.cmp(&a.version));

    Ok(Json(ReleaseListResponse { releases }))
}

/// DELETE /api/admin/releases/:version - Delete a release
pub async fn delete_release(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(version): Path<String>,
) -> Result<Json<DeleteReleaseResponse>, AppError> {
    let release_dir = state.config.release_path(&version);

    // Verify release exists
    if !release_dir.exists() {
        return Err(AppError::NotFound(format!(
            "Release {} not found",
            version
        )));
    }

    // Prevent deletion if it's the latest version
    if let Ok(latest) = storage::manifest::read_latest_manifest(&state.config).await {
        if latest.version == version {
            return Err(AppError::BadRequest(
                "Cannot delete the latest release. Promote another version first.".to_string(),
            ));
        }
    }

    // Delete release directory
    fs::remove_dir_all(&release_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to delete release: {}", e)))?;

    Ok(Json(DeleteReleaseResponse {
        message: format!("Release {} deleted successfully", version),
        deleted_version: version,
    }))
}

/// GET /api/admin/blacklist - Get current blacklist
pub async fn get_blacklist(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
) -> Result<Json<BlacklistResponse>, AppError> {
    let blacklist_path = state.config.blacklist_path();

    let patterns = if blacklist_path.exists() {
        let content = fs::read_to_string(&blacklist_path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read blacklist: {}", e)))?;

        content
            .lines()
            .filter(|line| !line.trim().is_empty() && !line.trim().starts_with('#'))
            .map(|line| line.trim().to_string())
            .collect()
    } else {
        // Return default blacklist
        vec![
            "optifine.txt".to_string(),
            "options.txt".to_string(),
            "optionsof.txt".to_string(),
            "journeymap/**".to_string(),
            "xaerominimap/**".to_string(),
            "xyzmaps/**".to_string(),
        ]
    };

    Ok(Json(BlacklistResponse { patterns }))
}

/// PUT /api/admin/blacklist - Update blacklist
pub async fn update_blacklist(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Json(request): Json<UpdateBlacklistRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let blacklist_path = state.config.blacklist_path();

    // Create parent directory if needed
    if let Some(parent) = blacklist_path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e)))?;
    }

    // Format patterns with comments
    let content = format!(
        "# Blacklist patterns - files matching these patterns are not synced to clients\n# Glob patterns are supported (e.g., journeymap/**, *.txt)\n{}",
        request
            .patterns
            .iter()
            .map(|p| format!("{}\n", p))
            .collect::<String>()
    );

    fs::write(&blacklist_path, content)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write blacklist: {}", e)))?;

    Ok(Json(json!({
        "message": "Blacklist updated successfully",
        "pattern_count": request.patterns.len()
    })))
}

// Error handling
pub enum AppError {
    Internal(anyhow::Error),
    NotFound(String),
    BadRequest(String),
    Unauthorized(String),
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            AppError::Internal(err) => {
                tracing::error!("Internal error: {}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
        };

        (status, Json(AdminError { error: message })).into_response()
    }
}
