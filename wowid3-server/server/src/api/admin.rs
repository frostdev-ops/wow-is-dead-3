use crate::config::Config;
use crate::middleware::AdminToken;
use crate::models::{
    AdminError, BlacklistResponse, CreateReleaseRequest, DeleteReleaseResponse, DraftFile,
    DraftRelease, LoginRequest, LoginResponse, Manifest, ManifestFile, ReleaseInfo,
    ReleaseListResponse, UpdateBlacklistRequest, UploadResponse,
};
use crate::storage;
use crate::utils;
use axum::{
    extract::{multipart::Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Utc;
use serde_json::json;
use sha2::Digest;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
use zip::ZipArchive;

#[derive(Clone)]
pub struct AdminState {
    pub config: Arc<Config>,
    pub admin_password: Arc<String>,
    pub cache: crate::cache::CacheManager,
}

/// Extract a zip file to the specified output directory
/// Returns a list of (relative_path, size) tuples for all extracted files
async fn extract_zip(zip_path: &PathBuf, output_dir: &PathBuf) -> Result<Vec<(String, u64)>, AppError> {
    // Read the zip file
    let zip_file = std::fs::File::open(zip_path)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to open zip file: {}", e)))?;

    let mut archive = ZipArchive::new(zip_file)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read zip archive: {}", e)))?;

    let mut extracted_files = Vec::new();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read zip entry: {}", e)))?;

        // Get the file path and sanitize it (prevent path traversal)
        let file_path = file.enclosed_name()
            .ok_or_else(|| AppError::BadRequest("Invalid file path in zip".to_string()))?
            .to_path_buf();

        let output_path = output_dir.join(&file_path);
        let is_dir = file.is_dir();

        if is_dir {
            // Create directory
            std::fs::create_dir_all(&output_path)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e)))?;
        } else {
            // Create parent directories if needed
            if let Some(parent) = output_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create parent directory: {}", e)))?;
            }

            // Extract file
            let mut output_file = std::fs::File::create(&output_path)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create output file: {}", e)))?;

            std::io::copy(&mut file, &mut output_file)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to extract file: {}", e)))?;

            // Get file size and relative path
            let file_size = output_path.metadata()
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to get file metadata: {}", e)))?
                .len();

            let relative_path = file_path.to_string_lossy().to_string();
            extracted_files.push((relative_path, file_size));

            tracing::info!("Extracted: {} ({} bytes)", file_path.display(), file_size);
        }
    }

    Ok(extracted_files)
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

/// POST /api/admin/upload - Upload modpack files (with automatic zip extraction)
pub async fn upload_files(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    mut multipart: Multipart,
) -> Result<Json<Vec<UploadResponse>>, AppError> {
    let start = std::time::Instant::now();
    let upload_id = Uuid::new_v4().to_string();
    let upload_dir = state.config.uploads_path().join(&upload_id);
    fs::create_dir_all(&upload_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create upload directory: {}", e)))?;

    let mut responses = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Multipart error: {}", e)))?
    {
        let file_name = field
            .file_name()
            .ok_or_else(|| AppError::BadRequest("Missing file name".to_string()))?
            .to_string();

        let is_zip = file_name.to_lowercase().ends_with(".zip");

        // Stream file to disk
        let temp_path = if is_zip {
            upload_dir.join(format!("temp_{}", file_name))
        } else {
            let file_path = upload_dir.join(&file_name);
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent)
                    .await
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create subdirectory: {}", e)))?;
            }
            file_path
        };

        // Stream to disk and calculate hash simultaneously
        let mut file = fs::File::create(&temp_path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create file: {}", e)))?;

        let mut hasher = sha2::Sha256::new();
        let mut total_bytes = 0u64;

        // Stream data in chunks
        let mut stream = field;
        while let Some(chunk) = stream
            .chunk()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read chunk: {}", e)))?
        {
            hasher.update(&chunk);
            total_bytes += chunk.len() as u64;
            file.write_all(&chunk)
                .await
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write chunk: {}", e)))?;
        }

        file.flush()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to flush file: {}", e)))?;
        drop(file);

        let sha256 = format!("{:x}", hasher.finalize());

        tracing::info!("Uploaded: {} ({} bytes, sha256: {})", file_name, total_bytes, &sha256[..12]);

        if is_zip {
            // Extract zip file
            tracing::info!("Extracting zip file: {}", file_name);
            let extracted_files = extract_zip(&temp_path, &upload_dir).await?;

            // Delete temp zip file
            fs::remove_file(&temp_path)
                .await
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to remove temp zip: {}", e)))?;

            // Calculate hashes for extracted files and add to responses
            for (relative_path, file_size) in extracted_files {
                let file_path = upload_dir.join(&relative_path);
                let data = fs::read(&file_path)
                    .await
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read extracted file: {}", e)))?;

                let mut file_hasher = sha2::Sha256::new();
                file_hasher.update(&data);
                let file_sha256 = format!("{:x}", file_hasher.finalize());

                responses.push(UploadResponse {
                    upload_id: upload_id.clone(),
                    file_name: relative_path,
                    file_size,
                    sha256: file_sha256,
                    message: format!("Extracted from {}", file_name),
                });
            }

            tracing::info!("Extracted {} files from {}", responses.len(), file_name);
        } else {
            // Regular file (not a zip)
            responses.push(UploadResponse {
                upload_id: upload_id.clone(),
                file_name,
                file_size: total_bytes,
                sha256,
                message: "File uploaded successfully".to_string(),
            });
        }
    }

    let duration = start.elapsed();
    tracing::info!("upload_files completed in {:?} ({} files, upload_id: {})", duration, responses.len(), upload_id);

    Ok(Json(responses))
}

/// POST /api/admin/releases - Create a new release from uploaded files
pub async fn create_release(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Json(request): Json<CreateReleaseRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let start = std::time::Instant::now();

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

    // Load blacklist patterns
    let blacklist_patterns = utils::load_blacklist_patterns(&state.config)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load blacklist: {}", e)))?;

    let glob_set = utils::compile_patterns(&blacklist_patterns)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to compile blacklist patterns: {}", e)))?;

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

        let relative_str = relative_path
            .to_string_lossy()
            .replace("\\", "/");

        // Check if file matches blacklist pattern
        if utils::is_blacklisted(&relative_str, &glob_set) {
            tracing::debug!("Skipping blacklisted file: {}", relative_str);
            continue;
        }

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

        files.push(ManifestFile {
            path: relative_str.clone(),
            url: format!(
                "{}/files/{}/{}",
                state.config.base_url, request.version, relative_str
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

    // Invalidate cache after creating release
    state.cache.invalidate_manifest("latest").await;
    state.cache.invalidate_manifest(&format!("version:{}", request.version)).await;

    // Clean up upload directory
    fs::remove_dir_all(&upload_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to clean up uploads: {}", e)))?;

    let duration = start.elapsed();
    tracing::info!("create_release completed in {:?} (version: {}, {} files, {} bytes)",
        duration, request.version, manifest.files.len(), total_size);

    Ok(Json(json!({
        "message": "Release created successfully",
        "version": request.version,
        "file_count": manifest.files.len(),
        "size_bytes": total_size,
        "changelog_preview": changelog_preview
    })))
}

/// Query parameters for pagination
#[derive(serde::Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: usize,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_page() -> usize { 1 }
fn default_limit() -> usize { 20 }

/// Paginated response wrapper
#[derive(serde::Serialize)]
pub struct PaginatedReleaseResponse {
    pub releases: Vec<ReleaseInfo>,
    pub page: usize,
    pub limit: usize,
    pub total: usize,
    pub total_pages: usize,
}

/// GET /api/admin/releases - List all releases with pagination
pub async fn list_releases(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    axum::extract::Query(pagination): axum::extract::Query<PaginationQuery>,
) -> Result<Json<PaginatedReleaseResponse>, AppError> {
    let start = std::time::Instant::now();

    let versions = storage::manifest::list_versions(&state.config)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to list versions: {}", e)))?;

    let total = versions.len();
    let limit = pagination.limit.min(100).max(1); // Cap at 100, min 1
    let page = pagination.page.max(1); // Min page 1
    let total_pages = (total + limit - 1) / limit; // Ceiling division

    // Calculate pagination bounds
    let start_idx = (page - 1) * limit;
    let end_idx = (start_idx + limit).min(total);

    let mut releases = Vec::new();

    // Only process releases for the current page
    for version in versions.iter().skip(start_idx).take(end_idx - start_idx) {
        match storage::manifest::read_manifest(&state.config, version).await {
            Ok(manifest) => {
                let release_dir = state.config.release_path(version);
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

    let duration = start.elapsed();
    tracing::info!("list_releases took {:?} (page {} of {}, {} items)", duration, page, total_pages, releases.len());

    Ok(Json(PaginatedReleaseResponse {
        releases,
        page,
        limit,
        total,
        total_pages,
    }))
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

/// POST /api/admin/releases/:version/copy-to-draft - Copy a release to a new draft
pub async fn copy_release_to_draft(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(version): Path<String>,
) -> Result<Json<DraftRelease>, AppError> {
    // Read the published release manifest
    let manifest = storage::manifest::read_manifest(&state.config, &version)
        .await
        .map_err(|_| AppError::NotFound(format!("Release {} not found", version)))?;

    // Create new draft with copied metadata
    let new_version = Some(format!("{}-copy", version));
    let new_draft = storage::create_draft(&state.config.storage_path(), new_version).await?;

    // Copy metadata
    let _updated_draft = storage::update_draft(
        &state.config.storage_path(),
        new_draft.id,
        Some(new_draft.version.clone()),
        Some(manifest.minecraft_version.clone()),
        Some(manifest.fabric_loader.clone()),
        Some(manifest.changelog.clone()),
    ).await?;

    // Copy files from release to draft
    let release_dir = state.config.release_path(&version);
    let draft_files_dir = storage::get_draft_files_dir(&state.config.storage_path(), new_draft.id);

    // Copy all files
    copy_dir_all_recursive(&release_dir, &draft_files_dir).await?;

    // Regenerate checksums from copied files instead of copying old checksums
    // This ensures files have accurate checksums even if they were modified
    let fresh_files = scan_directory_files(&draft_files_dir).await?;

    // Set files in draft with fresh checksums (replaces, not appends)
    let final_draft = storage::set_draft_files(
        &state.config.storage_path(),
        new_draft.id,
        fresh_files,
    ).await?;

    Ok(Json(final_draft))
}

// Helper function to recursively copy directories
async fn copy_dir_all_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), AppError> {
    fs::create_dir_all(dst).await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create directory: {}", e)))?;

    for entry in walkdir::WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            let relative = path
                .strip_prefix(src)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;

            let dest_path = dst.join(relative);
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).await
                    .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create parent directory: {}", e)))?;
            }

            fs::copy(path, &dest_path).await
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to copy file: {}", e)))?;
        }
    }

    Ok(())
}

/// Scan a directory and generate DraftFile entries with fresh SHA256 checksums
async fn scan_directory_files(dir: &PathBuf) -> Result<Vec<DraftFile>, AppError> {
    let mut files = Vec::new();

    for entry in walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        let relative_path = path
            .strip_prefix(dir)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Path error: {}", e)))?;

        let relative_str = relative_path
            .to_str()
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid path encoding")))?;

        // Calculate fresh checksum
        let data = fs::read(path).await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e)))?;
        let mut hasher = sha2::Sha256::new();
        hasher.update(&data);
        let sha256 = format!("{:x}", hasher.finalize());

        files.push(DraftFile {
            path: relative_str.to_string(),
            url: None, // URLs are generated when publishing
            sha256,
            size: data.len() as u64,
        });
    }

    Ok(files)
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

/// GET /api/admin/cache/stats - Get cache statistics
pub async fn get_cache_stats(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
) -> Result<Json<crate::cache::CacheStats>, AppError> {
    let stats = state.cache.get_stats().await;
    Ok(Json(stats))
}

/// POST /api/admin/cache/clear - Clear all caches
pub async fn clear_cache(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.cache.clear_all().await;
    Ok(Json(json!({
        "message": "All caches cleared successfully"
    })))
}

/// POST /api/admin/cache/clear/manifests - Clear manifest cache only
pub async fn clear_manifest_cache(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.cache.clear_manifests().await;
    Ok(Json(json!({
        "message": "Manifest cache cleared successfully"
    })))
}

/// POST /api/admin/cache/clear/jar - Clear JAR metadata cache only
pub async fn clear_jar_cache(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.cache.clear_jar_metadata().await;
    Ok(Json(json!({
        "message": "JAR metadata cache cleared successfully"
    })))
}

/// POST /api/admin/resources - Upload resource pack files
pub async fn upload_resource(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    mut multipart: Multipart,
) -> Result<Json<Vec<UploadResponse>>, AppError> {
    let start = std::time::Instant::now();
    let resources_dir = state.config.resources_path();

    // Ensure resources directory exists
    fs::create_dir_all(&resources_dir)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create resources directory: {}", e)))?;

    let mut responses = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Multipart error: {}", e)))?
    {
        let file_name = field
            .file_name()
            .ok_or_else(|| AppError::BadRequest("Missing file name".to_string()))?
            .to_string();

        // Prevent directory traversal
        if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
            return Err(AppError::BadRequest("Invalid file name".to_string()));
        }

        let file_path = resources_dir.join(&file_name);

        // Stream to disk and calculate hash simultaneously
        let mut file = fs::File::create(&file_path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create file: {}", e)))?;

        let mut hasher = sha2::Sha256::new();
        let mut total_bytes = 0u64;

        // Stream data in chunks
        let mut stream = field;
        while let Some(chunk) = stream
            .chunk()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read chunk: {}", e)))?
        {
            hasher.update(&chunk);
            total_bytes += chunk.len() as u64;
            file.write_all(&chunk)
                .await
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write chunk: {}", e)))?;
        }

        file.flush()
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to flush file: {}", e)))?;
        drop(file);

        let sha256 = format!("{:x}", hasher.finalize());

        tracing::info!("Uploaded resource: {} ({} bytes, sha256: {})", file_name, total_bytes, &sha256[..12]);

        responses.push(UploadResponse {
            upload_id: "resources".to_string(),
            file_name,
            file_size: total_bytes,
            sha256,
            message: "Resource uploaded successfully".to_string(),
        });
    }

    let duration = start.elapsed();
    tracing::info!("upload_resource completed in {:?} ({} files)", duration, responses.len());

    Ok(Json(responses))
}

/// DELETE /api/admin/resources/:filename - Delete a resource pack
pub async fn delete_resource(
    State(state): State<AdminState>,
    Extension(_token): Extension<AdminToken>,
    Path(filename): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Prevent directory traversal
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(AppError::BadRequest("Invalid file name".to_string()));
    }

    let resources_dir = state.config.resources_path();
    let file_path = resources_dir.join(&filename);

    // Security: Ensure the file is within the resources directory
    let canonical_resources = fs::canonicalize(&resources_dir).await.map_err(|_| {
        AppError::Internal(anyhow::anyhow!("Resources directory not found"))
    })?;

    let canonical_file = fs::canonicalize(&file_path).await.map_err(|_| {
        AppError::NotFound(format!("Resource {} not found", filename))
    })?;

    if !canonical_file.starts_with(&canonical_resources) {
        return Err(AppError::Forbidden("Path traversal attempt detected".to_string()));
    }

    // Delete the file
    fs::remove_file(&canonical_file)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to delete resource: {}", e)))?;

    tracing::info!("Deleted resource: {}", filename);

    Ok(Json(json!({
        "message": format!("Resource {} deleted successfully", filename)
    })))
}

// Error handling
pub enum AppError {
    Internal(anyhow::Error),
    NotFound(String),
    BadRequest(String),
    Unauthorized(String),
    Forbidden(String),
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
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
        };

        (status, Json(AdminError { error: message })).into_response()
    }
}
