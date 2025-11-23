use crate::config::Config;
use crate::models::{Manifest, manifest::{LauncherVersion, LauncherVersionsIndex}, TrackerState};
use crate::storage;
use crate::utils;
use anyhow;
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Json,
};
use serde::Serialize;
use sha2::Digest;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use tokio::io::AsyncReadExt;
use tokio_util::io::ReaderStream;

#[derive(Debug, Serialize, Clone)]
pub struct ResourcePackInfo {
    pub file_name: String,
    pub file_size: u64,
    pub sha256: String,
}

use crate::services::stats_processor::StatsProcessor;
use crate::database::Database;

#[derive(Clone)]
pub struct PublicState {
    pub config: Arc<Config>,
    pub cache: crate::cache::CacheManager,
    pub tracker: Arc<RwLock<TrackerState>>,
    pub db: Database,
    pub stats_processor: Arc<StatsProcessor>,
}

/// Helper: Serve launcher file by platform and file type
async fn serve_launcher_file_by_type(
    state: &PublicState,
    platform: &str,
    file_type: &str,
) -> Result<Response, AppError> {
    // Load latest version
    let index = storage::launcher::load_launcher_versions_index(&state.config)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load versions: {}", e)))?;

    if index.latest.is_empty() {
        return Err(AppError::NotFound("No launcher versions available".to_string()));
    }

    let version = storage::launcher::load_launcher_version(&state.config, &index.latest)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load version: {}", e)))?;

    // Find matching file
    let file = version
        .files
        .iter()
        .find(|f| {
            f.platform == platform &&
            f.file_type.as_deref() == Some(file_type)
        })
        .ok_or_else(|| {
            AppError::NotFound(format!("No {} available for {}", file_type, platform))
        })?;

    // Get file path
    let file_path = state.config.launcher_version_path(&version.version).join(&file.filename);

    if !file_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", file.filename)));
    }

    // Stream file
    let file_handle = fs::File::open(&file_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to open file: {}", e)))?;

    let stream = ReaderStream::new(file_handle);
    let body = Body::from_stream(stream);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file.filename),
        )
        .header(header::CONTENT_LENGTH, file.size.to_string())
        .body(body)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to build response: {}", e)))?;

    Ok(response)
}

/// GET /api/launcher/latest/installer - Auto-detect platform and serve installer
pub async fn get_launcher_installer(
    headers: axum::http::HeaderMap,
    State(state): State<PublicState>,
) -> Result<Response, AppError> {
    use crate::utils::platform::detect_platform_from_user_agent;

    let platform = detect_platform_from_user_agent(&headers)
        .ok_or_else(|| {
            AppError::BadRequest(
                "Could not detect platform from User-Agent. Use /api/launcher/latest/installer/{platform}".to_string()
            )
        })?;

    serve_launcher_file_by_type(&state, &platform, "installer").await
}

/// GET /api/launcher/latest/installer/{platform}
pub async fn get_launcher_installer_platform(
    Path(platform): Path<String>,
    State(state): State<PublicState>,
) -> Result<Response, AppError> {
    // Validate platform
    if !matches!(platform.as_str(), "windows" | "linux" | "macos") {
        return Err(AppError::BadRequest(format!("Invalid platform: {}", platform)));
    }

    serve_launcher_file_by_type(&state, &platform, "installer").await
}

/// GET /api/launcher/latest/executable - Auto-detect platform and serve executable
pub async fn get_launcher_executable(
    headers: axum::http::HeaderMap,
    State(state): State<PublicState>,
) -> Result<Response, AppError> {
    use crate::utils::platform::detect_platform_from_user_agent;

    let platform = detect_platform_from_user_agent(&headers)
        .ok_or_else(|| {
            AppError::BadRequest(
                "Could not detect platform from User-Agent. Use /api/launcher/latest/executable/{platform}".to_string()
            )
        })?;

    serve_launcher_file_by_type(&state, &platform, "executable").await
}

/// GET /api/launcher/latest/executable/{platform}
pub async fn get_launcher_executable_platform(
    Path(platform): Path<String>,
    State(state): State<PublicState>,
) -> Result<Response, AppError> {
    // Validate platform
    if !matches!(platform.as_str(), "windows" | "linux" | "macos") {
        return Err(AppError::BadRequest(format!("Invalid platform: {}", platform)));
    }

    serve_launcher_file_by_type(&state, &platform, "executable").await
}

/// GET /api/launcher/latest - Redirect to executable endpoint (backward compat)
pub async fn get_latest_launcher_redirect() -> Redirect {
    Redirect::permanent("/api/launcher/latest/executable")
}

/// GET /files/launcher/:filename - Serve launcher files (legacy, for current Windows-only release)
pub async fn serve_launcher_file(
    State(state): State<PublicState>,
    Path(filename): Path<String>,
) -> Result<Response, AppError> {
    // Security: Only allow specific launcher filenames
    let allowed_files = vec!["WOWID3Launcher.exe"];

    if !allowed_files.contains(&filename.as_str()) {
        return Err(AppError::NotFound(format!("File {} not found", filename)));
    }

    let launcher_dir = state.config.launcher_path();
    let file_path = launcher_dir.join(&filename);

    if !file_path.exists() {
        return Err(AppError::NotFound(format!("File {} not found", filename)));
    }

    let file = fs::File::open(&file_path).await.map_err(|_| {
        AppError::NotFound(format!("Could not open file: {}", filename))
    })?;

    let content_type = "application/vnd.microsoft.portable-executable";

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", filename))
        .body(body)
        .unwrap())
}

/// GET /files/launcher/versions/:version/:filename - Serve versioned launcher files (multi-platform)
pub async fn serve_versioned_launcher_file(
    State(state): State<PublicState>,
    Path((version, filename)): Path<(String, String)>,
) -> Result<Response, AppError> {
    // Security: Validate filename format and extension
    let allowed_extensions = vec![".exe", ".AppImage"];
    let has_allowed_ext = allowed_extensions.iter().any(|ext| filename.ends_with(ext));

    if !has_allowed_ext {
        return Err(AppError::NotFound(format!("File {} not found", filename)));
    }

    // Validate filename doesn't contain path traversal attempts
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err(AppError::NotFound("Invalid filename".to_string()));
    }

    let file_path = state.config.launcher_version_file_path(&version, &filename);

    if !file_path.exists() {
        return Err(AppError::NotFound(format!("File {} for version {} not found", filename, version)));
    }

    let file = fs::File::open(&file_path).await.map_err(|_| {
        AppError::NotFound(format!("Could not open file: {}", filename))
    })?;

    // Determine content type based on extension
    let content_type = if filename.ends_with(".exe") {
        "application/vnd.microsoft.portable-executable"
    } else if filename.ends_with(".AppImage") {
        "application/x-executable"
    } else {
        "application/octet-stream"
    };

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", filename))
        .body(body)
        .unwrap())
}

/// GET /api/launcher/versions - List all available launcher versions
pub async fn get_launcher_versions(
    State(state): State<PublicState>,
) -> Result<Json<LauncherVersionsIndex>, AppError> {
    let index = storage::launcher::load_launcher_versions_index(&state.config)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load versions: {}", e)))?;

    Ok(Json(index))
}

/// GET /api/launcher/:version - Get a specific launcher version manifest
pub async fn get_launcher_version(
    State(state): State<PublicState>,
    Path(version): Path<String>,
) -> Result<Json<LauncherVersion>, AppError> {
    let version_manifest = storage::launcher::load_launcher_version(&state.config, &version)
        .await
        .map_err(|_| AppError::NotFound(format!("Version {} not found", version)))?;

    Ok(Json(version_manifest))
}

/// GET /api/manifest/latest
pub async fn get_latest_manifest(
    State(state): State<PublicState>,
) -> Result<Json<Manifest>, AppError> {
    // Try to get from cache first
    if let Some(manifest) = state.cache.get_manifest("latest").await {
        return Ok(Json((*manifest).clone()));
    }

    // Cache miss - read from disk
    let manifest = storage::read_latest_manifest(&state.config).await?;

    // Store in cache
    state.cache.put_manifest("latest".to_string(), manifest.clone()).await;

    Ok(Json(manifest))
}

/// GET /api/manifest/:version
pub async fn get_manifest_by_version(
    State(state): State<PublicState>,
    Path(version): Path<String>,
) -> Result<Json<Manifest>, AppError> {
    let cache_key = format!("version:{}", version);

    // Try to get from cache first
    if let Some(manifest) = state.cache.get_manifest(&cache_key).await {
        return Ok(Json((*manifest).clone()));
    }

    // Cache miss - read from disk
    let manifest = storage::read_manifest(&state.config, &version).await?;

    // Store in cache
    state.cache.put_manifest(cache_key, manifest.clone()).await;

    Ok(Json(manifest))
}

/// GET /api/assets/:filename
pub async fn serve_audio_file(
    State(state): State<PublicState>,
    Path(filename): Path<String>,
) -> Result<Response, AppError> {
    // Security: Only allow specific audio filenames
    let allowed_files = [
        "wid3menu.mp3",
        "wid3menu-fallback.mp3",
    ];

    if !allowed_files.contains(&filename.as_str()) {
        return Err(AppError::NotFound(format!("Audio file {} not found", filename)));
    }

    // Construct full file path
    let assets_path = state.config.storage_path().join("assets");
    let full_path = assets_path.join(&filename);

    // Check if file exists
    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Audio file {} not found", filename)));
    }

    // Open and stream the file
    let file = fs::File::open(&full_path).await.map_err(|_| {
        AppError::NotFound(format!("Could not open file: {}", filename))
    })?;

    // Determine content type
    let content_type = "audio/mpeg";

    // Create streaming body
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Build response with proper headers
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=86400") // Cache for 24 hours
        .body(body)
        .unwrap())
}

/// GET /api/java/:filename
pub async fn serve_java_runtime(
    State(state): State<PublicState>,
    Path(filename): Path<String>,
) -> Result<Response, AppError> {
    // Security: Only allow specific Java runtime filenames
    let allowed_files = [
        "zulu21-windows-x64.zip",
        "zulu21-macos-x64.tar.gz",
        "zulu21-macos-aarch64.tar.gz",
        "zulu21-linux-x64.tar.gz",
    ];

    if !allowed_files.contains(&filename.as_str()) {
        return Err(AppError::NotFound(format!("Java runtime {} not found", filename)));
    }

    // Construct full file path
    let java_path = state.config.storage_path().join("java");
    let full_path = java_path.join(&filename);

    // Check if file exists
    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Java runtime {} not found", filename)));
    }

    // Open and stream the file
    let file = fs::File::open(&full_path).await.map_err(|_| {
        AppError::NotFound(format!("Could not open file: {}", filename))
    })?;

    // Determine content type
    let content_type = if filename.ends_with(".zip") {
        "application/zip"
    } else {
        "application/gzip"
    };

    // Create streaming body
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Build response with proper headers
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", filename))
        .body(body)
        .unwrap())
}

/// GET /files/:version/*path
pub async fn serve_file(
    State(state): State<PublicState>,
    Path((version, file_path)): Path<(String, String)>,
) -> Result<Response, AppError> {
    // Construct full file path
    let release_path = state.config.release_path(&version);
    let full_path = release_path.join(&file_path);

    // Security: Ensure the file is within the release directory (prevent path traversal)
    let canonical_release = fs::canonicalize(&release_path).await.map_err(|_| {
        AppError::NotFound(format!("Release {} not found", version))
    })?;

    let canonical_file = fs::canonicalize(&full_path).await.map_err(|_| {
        AppError::NotFound(format!("File {} not found", file_path))
    })?;

    if !canonical_file.starts_with(&canonical_release) {
        return Err(AppError::Forbidden("Path traversal attempt detected".to_string()));
    }

    // Check blacklist before serving
    let blacklist_patterns = utils::load_blacklist_patterns(&state.config)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load blacklist: {}", e)))?;

    let glob_set = utils::compile_patterns(&blacklist_patterns)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to compile blacklist patterns: {}", e)))?;

    if utils::is_blacklisted(&file_path, &glob_set) {
        tracing::debug!("Blocked access to blacklisted file: {}", file_path);
        return Err(AppError::Forbidden("File access denied".to_string()));
    }

    // Open and stream the file
    let file = fs::File::open(&canonical_file).await.map_err(|_| {
        AppError::NotFound(format!("Could not open file: {}", file_path))
    })?;

    // Guess content type from file extension
    let content_type = mime_guess::from_path(&canonical_file)
        .first_or_octet_stream()
        .to_string();

    // Create streaming body
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Build response with proper headers
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .body(body)
        .unwrap())
}

/// GET /api/resources - List all available resource packs
pub async fn list_resources(
    State(state): State<PublicState>,
) -> Result<Json<Vec<ResourcePackInfo>>, AppError> {
    let resources_path = state.config.resources_path();

    // Check if directory exists
    if !resources_path.exists() {
        return Ok(Json(Vec::new()));
    }

    let mut resource_packs = Vec::new();
    let mut entries = fs::read_dir(&resources_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read resources directory: {}", e)))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read directory entry: {}", e)))?
    {
        let path = entry.path();

        // Skip directories, only process files
        if path.is_dir() {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Invalid filename")))?;

        // Get file metadata
        let metadata = fs::metadata(&path)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to get file metadata: {}", e)))?;

        // Calculate SHA256 hash
        let sha256 = match calculate_sha256(&path).await {
            Ok(hash) => hash,
            Err(_) => "unknown".to_string(),
        };

        resource_packs.push(ResourcePackInfo {
            file_name,
            file_size: metadata.len(),
            sha256,
        });
    }

    // Sort by file name
    resource_packs.sort_by(|a, b| a.file_name.cmp(&b.file_name));

    Ok(Json(resource_packs))
}

/// GET /api/resources/:filename
pub async fn serve_resource(
    State(state): State<PublicState>,
    Path(filename): Path<String>,
) -> Result<Response, AppError> {
    // Security: Prevent directory traversal by ensuring filename is just a filename
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(AppError::Forbidden("Invalid filename".to_string()));
    }

    // Construct full file path
    let resources_path = state.config.resources_path();
    let full_path = resources_path.join(&filename);

    // Security: Ensure the file is within the resources directory (prevent path traversal)
    let canonical_resources = fs::canonicalize(&resources_path).await.map_err(|_| {
        AppError::Internal(anyhow::anyhow!("Resources directory not found"))
    })?;

    let canonical_file = fs::canonicalize(&full_path).await.map_err(|_| {
        AppError::NotFound(format!("Resource {} not found", filename))
    })?;

    if !canonical_file.starts_with(&canonical_resources) {
        return Err(AppError::Forbidden("Path traversal attempt detected".to_string()));
    }

    // Open and stream the file
    let file = fs::File::open(&canonical_file).await.map_err(|_| {
        AppError::NotFound(format!("Could not open resource: {}", filename))
    })?;

    // Guess content type from file extension
    let content_type = mime_guess::from_path(&canonical_file)
        .first_or_octet_stream()
        .to_string();

    // Create streaming body
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Build response with proper headers
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", filename))
        .body(body)
        .unwrap())
}

/// Get latest launcher version manifest as JSON
pub async fn get_launcher_manifest_latest(
    State(state): State<PublicState>,
) -> Result<Json<LauncherVersion>, AppError> {
    // Load versions index to get latest version
    let index = storage::launcher::load_launcher_versions_index(&state.config)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load versions: {}", e)))?;

    if index.latest.is_empty() {
        return Err(AppError::NotFound("No launcher versions available".to_string()));
    }

    // Load the latest version
    let version = storage::launcher::load_launcher_version(&state.config, &index.latest)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to load version: {}", e)))?;

    Ok(Json(version))
}

/// Get specific launcher version manifest as JSON
pub async fn get_launcher_manifest_version(
    State(state): State<PublicState>,
    Path(version): Path<String>,
) -> Result<Json<LauncherVersion>, AppError> {
    let launcher_version = storage::launcher::load_launcher_version(&state.config, &version)
        .await
        .map_err(|_| AppError::NotFound(format!("Version {} not found", version)))?;

    Ok(Json(launcher_version))
}

/// Helper function to calculate SHA256 hash of a file
async fn calculate_sha256(path: &std::path::Path) -> Result<String, anyhow::Error> {
    let mut file = fs::File::open(path).await?;
    let mut hasher = sha2::Sha256::new();
    let mut buffer = vec![0; 8192];

    loop {
        let n = file.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

// Error handling
pub enum AppError {
    Internal(anyhow::Error),
    NotFound(String),
    Forbidden(String),
    BadRequest(String),
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Internal(err) => {
                tracing::error!("Internal error: {}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
        };

        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}
