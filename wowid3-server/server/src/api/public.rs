use crate::config::Config;
use crate::models::Manifest;
use crate::storage;
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
}

/// GET /api/manifest/latest
pub async fn get_latest_manifest(
    State(state): State<PublicState>,
) -> Result<Json<Manifest>, AppError> {
    let manifest = storage::read_latest_manifest(&state.config).await?;
    Ok(Json(manifest))
}

/// GET /api/manifest/:version
pub async fn get_manifest_by_version(
    State(state): State<PublicState>,
    Path(version): Path<String>,
) -> Result<Json<Manifest>, AppError> {
    let manifest = storage::read_manifest(&state.config, &version).await?;
    Ok(Json(manifest))
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
