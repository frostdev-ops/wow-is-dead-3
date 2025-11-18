use crate::config::Config;
use crate::models::Manifest;
use crate::storage;
use crate::utils;
use anyhow;
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;
use tokio::fs;
use tokio_util::io::ReaderStream;

#[derive(Clone)]
pub struct PublicState {
    pub config: Arc<Config>,
    pub cache: crate::cache::CacheManager,
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

// Error handling
pub enum AppError {
    Internal(anyhow::Error),
    NotFound(String),
    Forbidden(String),
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
        };

        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}
