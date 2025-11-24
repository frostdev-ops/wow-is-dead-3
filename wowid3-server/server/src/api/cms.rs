use crate::config::Config;
use crate::models::{
    AssetUploadResponse, CmsConfig, ListAssetsResponse, UpdateCmsConfigRequest,
};
use crate::storage;
use axum::{
    body::Bytes,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Json, Response},
};
use std::sync::Arc;
use tokio::fs;
use tracing::{error, info};

// ===== Public API (No Auth) =====

/// Get CMS configuration (public endpoint for launcher)
pub async fn get_cms_config(State(state): State<Arc<CmsState>>) -> Result<Json<CmsConfig>, CmsError> {
    let config = storage::load_cms_config(&state.config.storage_path())
        .await
        .map_err(|e| {
            error!("Failed to load CMS config: {}", e);
            CmsError::InternalError("Failed to load configuration".to_string())
        })?;

    Ok(Json(config))
}

/// Serve an asset file (public endpoint for launcher)
pub async fn serve_asset(
    State(state): State<Arc<CmsState>>,
    Path(filename): Path<String>,
) -> Result<Response, CmsError> {
    // Sanitize filename to prevent path traversal
    let filename = filename.replace("..", "").replace("/", "").replace("\\", "");

    let file_path = storage::get_asset_file_path(&state.config.storage_path(), &filename);

    if !file_path.exists() {
        return Err(CmsError::NotFound(format!("Asset '{}' not found", filename)));
    }

    let data = fs::read(&file_path).await.map_err(|e| {
        error!("Failed to read asset file: {}", e);
        CmsError::InternalError("Failed to read asset file".to_string())
    })?;

    // Guess content type from extension
    let content_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    Ok(([(header::CONTENT_TYPE, content_type)], data).into_response())
}

// ===== Admin API (Requires Auth) =====

/// Get CMS configuration (admin endpoint with full details)
pub async fn admin_get_cms_config(
    State(state): State<Arc<CmsState>>,
) -> Result<Json<CmsConfig>, CmsError> {
    get_cms_config(State(state)).await
}

/// Update CMS configuration
pub async fn admin_update_cms_config(
    State(state): State<Arc<CmsState>>,
    Json(request): Json<UpdateCmsConfigRequest>,
) -> Result<Json<CmsConfig>, CmsError> {
    let config = storage::update_cms_config(&state.config.storage_path(), |config| {
        if let Some(branding) = request.branding {
            config.branding = branding;
        }
        if let Some(server) = request.server {
            config.server = server;
        }
        if let Some(ui) = request.ui {
            config.ui = ui;
        }
        if let Some(performance) = request.performance {
            config.performance = performance;
        }
        if let Some(features) = request.features {
            config.features = features;
        }
        if let Some(assets) = request.assets {
            config.assets = assets;
        }
        if let Some(themes) = request.themes {
            config.themes = themes;
        }
    })
    .await
    .map_err(|e| {
        error!("Failed to update CMS config: {}", e);
        CmsError::InternalError("Failed to update configuration".to_string())
    })?;

    info!("CMS configuration updated to version {}", config.version);

    Ok(Json(config))
}

/// Reset CMS configuration to defaults
pub async fn admin_reset_cms_config(
    State(state): State<Arc<CmsState>>,
) -> Result<Json<CmsConfig>, CmsError> {
    let default_config = CmsConfig::default();

    storage::save_cms_config(&state.config.storage_path(), &default_config)
        .await
        .map_err(|e| {
            error!("Failed to reset CMS config: {}", e);
            CmsError::InternalError("Failed to reset configuration".to_string())
        })?;

    info!("CMS configuration reset to defaults");

    Ok(Json(default_config))
}

/// List all assets
pub async fn admin_list_assets(
    State(state): State<Arc<CmsState>>,
) -> Result<Json<ListAssetsResponse>, CmsError> {
    let assets = storage::list_assets(&state.config.storage_path())
        .await
        .map_err(|e| {
            error!("Failed to list assets: {}", e);
            CmsError::InternalError("Failed to list assets".to_string())
        })?;

    Ok(Json(ListAssetsResponse { assets }))
}

/// Upload an asset
pub async fn admin_upload_asset(
    State(state): State<Arc<CmsState>>,
    mut multipart: Multipart,
) -> Result<Json<AssetUploadResponse>, CmsError> {
    let mut filename: Option<String> = None;
    let mut data: Option<Bytes> = None;

    // Parse multipart form
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        error!("Failed to read multipart field: {}", e);
        CmsError::BadRequest("Invalid multipart data".to_string())
    })? {
        let field_name = field.name().unwrap_or("").to_string();

        match field_name.as_str() {
            "file" => {
                // Get original filename
                if let Some(fname) = field.file_name() {
                    filename = Some(fname.to_string());
                }

                // Read file data
                data = Some(field.bytes().await.map_err(|e| {
                    error!("Failed to read file data: {}", e);
                    CmsError::BadRequest("Failed to read file data".to_string())
                })?);
            }
            "filename" => {
                // Allow explicit filename override
                let override_name = field.text().await.map_err(|e| {
                    error!("Failed to read filename field: {}", e);
                    CmsError::BadRequest("Failed to read filename".to_string())
                })?;
                filename = Some(override_name);
            }
            _ => {}
        }
    }

    let filename = filename.ok_or_else(|| {
        CmsError::BadRequest("Missing filename in upload".to_string())
    })?;

    let data = data.ok_or_else(|| {
        CmsError::BadRequest("Missing file data in upload".to_string())
    })?;

    // Save asset
    let metadata = storage::save_asset(&state.config.storage_path(), &filename, &data)
        .await
        .map_err(|e| {
            error!("Failed to save asset: {}", e);
            CmsError::InternalError("Failed to save asset".to_string())
        })?;

    info!("Asset uploaded: {} ({} bytes)", filename, metadata.size);

    // Generate asset URL
    let url = format!("{}/api/cms/assets/{}", state.config.base_url, filename);

    Ok(Json(AssetUploadResponse {
        filename,
        url,
        metadata,
    }))
}

/// Delete an asset
pub async fn admin_delete_asset(
    State(state): State<Arc<CmsState>>,
    Path(filename): Path<String>,
) -> Result<Json<serde_json::Value>, CmsError> {
    // Sanitize filename
    let filename = filename.replace("..", "").replace("/", "").replace("\\", "");

    storage::delete_asset(&state.config.storage_path(), &filename)
        .await
        .map_err(|e| {
            error!("Failed to delete asset: {}", e);
            CmsError::InternalError("Failed to delete asset".to_string())
        })?;

    info!("Asset deleted: {}", filename);

    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("Asset '{}' deleted successfully", filename)
    })))
}

// ===== State and Error Handling =====

#[derive(Clone)]
pub struct CmsState {
    pub config: Config,
}

#[derive(Debug)]
pub enum CmsError {
    NotFound(String),
    BadRequest(String),
    InternalError(String),
}

impl IntoResponse for CmsError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            CmsError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            CmsError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            CmsError::InternalError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}
