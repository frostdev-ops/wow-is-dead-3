use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tracing::error;

/// BlueMap base path - mounted Minecraft server filesystem
const BLUEMAP_BASE_PATH: &str = "/mnt/wowid3/bluemap/web";

#[derive(Clone)]
pub struct BlueMapState {
    pub base_path: PathBuf,
}

impl BlueMapState {
    pub fn new() -> Self {
        Self {
            base_path: PathBuf::from(BLUEMAP_BASE_PATH),
        }
    }
}

/// Serve global BlueMap settings
pub async fn get_global_settings(
    State(state): State<Arc<BlueMapState>>,
) -> Result<Response, StatusCode> {
    let file_path = state.base_path.join("settings.json");
    serve_file_internal(file_path, "application/json").await
}

/// Serve BlueMap webapp static files (index.html, assets/, lang/, etc.)
pub async fn serve_webapp_file(
    State(state): State<Arc<BlueMapState>>,
    Path(path): Path<String>,
) -> Result<Response, StatusCode> {
    // Handle map data textures.json specially - serve the .gz file with proper encoding
    if path.ends_with("textures.json") && path.starts_with("maps/") {
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() >= 3 && parts[0] == "maps" {
            let map_id = parts[1].to_string();
            // Call the textures handler directly
            return get_map_textures(State(state), Path(map_id)).await;
        }
    }

    // Security: prevent path traversal
    if path.contains("..") {
        error!("Path traversal attempt detected: {}", path);
        return Err(StatusCode::FORBIDDEN);
    }

    let file_path = state.base_path.join(&path);

    // Ensure the path is within the base path
    if !file_path.starts_with(&state.base_path) {
        error!("Path outside base directory: {:?}", file_path);
        return Err(StatusCode::FORBIDDEN);
    }

    // Determine content type from extension
    let content_type = match file_path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html",
        Some("css") => "text/css",
        Some("js") => "application/javascript",
        Some("json") => "application/json",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("svg") => "image/svg+xml",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        _ => "application/octet-stream",
    };

    serve_file_internal(file_path, content_type).await
}

/// Serve map-specific settings
pub async fn get_map_settings(
    State(state): State<Arc<BlueMapState>>,
    Path(map_id): Path<String>,
) -> Result<Response, StatusCode> {
    // Security: validate map_id
    if map_id.contains("..") || map_id.contains('/') {
        error!("Invalid map_id: {}", map_id);
        return Err(StatusCode::FORBIDDEN);
    }

    let file_path = state.base_path.join("maps").join(&map_id).join("settings.json");
    serve_file_internal(file_path, "application/json").await
}

/// Serve map textures (handles both .json and .json.gz requests)
pub async fn get_map_textures(
    State(state): State<Arc<BlueMapState>>,
    Path(map_id): Path<String>,
) -> Result<Response, StatusCode> {
    // Security: validate map_id
    if map_id.contains("..") || map_id.contains('/') {
        error!("Invalid map_id: {}", map_id);
        return Err(StatusCode::FORBIDDEN);
    }

    // The actual file is textures.json.gz
    let file_path = state.base_path.join("maps").join(&map_id).join("textures.json.gz");

    // Check if file exists
    if !file_path.exists() {
        error!("File not found: {:?}", file_path);
        return Err(StatusCode::NOT_FOUND);
    }

    // Read file
    let contents = tokio::fs::read(&file_path).await.map_err(|e| {
        error!("Failed to read file {:?}: {}", file_path, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Serve the gzipped file with proper headers
    // BlueMap can handle gzip-encoded responses
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/json"),
            (header::CONTENT_ENCODING, "gzip"),
            (header::CACHE_CONTROL, "public, max-age=300"),
            (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
        ],
        contents,
    )
        .into_response())
}

/// Serve map textures with .gz extension (legacy support)
pub async fn get_map_textures_gz(
    State(state): State<Arc<BlueMapState>>,
    Path(map_id): Path<String>,
) -> Result<Response, StatusCode> {
    // Just call the main textures handler
    get_map_textures(State(state), Path(map_id)).await
}

/// Serve live markers
pub async fn get_live_markers(
    State(state): State<Arc<BlueMapState>>,
    Path(map_id): Path<String>,
) -> Result<Response, StatusCode> {
    // Security: validate map_id
    if map_id.contains("..") || map_id.contains('/') {
        error!("Invalid map_id: {}", map_id);
        return Err(StatusCode::FORBIDDEN);
    }

    let file_path = state.base_path.join("maps").join(&map_id).join("live").join("markers.json");
    serve_file_internal(file_path, "application/json").await
}

/// Serve live player positions
pub async fn get_live_players(
    State(state): State<Arc<BlueMapState>>,
    Path(map_id): Path<String>,
) -> Result<Response, StatusCode> {
    // Security: validate map_id
    if map_id.contains("..") || map_id.contains('/') {
        error!("Invalid map_id: {}", map_id);
        return Err(StatusCode::FORBIDDEN);
    }

    let file_path = state.base_path.join("maps").join(&map_id).join("live").join("players.json");
    serve_file_internal(file_path, "application/json").await
}

/// Serve map tiles (hires or lowres)
pub async fn get_map_tile(
    State(state): State<Arc<BlueMapState>>,
    Path((map_id, tile_path)): Path<(String, String)>,
) -> Result<Response, StatusCode> {
    // Security: validate map_id and tile_path
    if map_id.contains("..") || map_id.contains('/') {
        error!("Invalid map_id: {}", map_id);
        return Err(StatusCode::FORBIDDEN);
    }
    if tile_path.contains("..") {
        error!("Path traversal attempt in tile_path: {}", tile_path);
        return Err(StatusCode::FORBIDDEN);
    }

    let file_path = state.base_path.join("maps").join(&map_id).join("tiles").join(&tile_path);

    // Ensure the path is within the expected directory
    let expected_base = state.base_path.join("maps").join(&map_id).join("tiles");
    if !file_path.starts_with(&expected_base) {
        error!("Tile path outside expected directory: {:?}", file_path);
        return Err(StatusCode::FORBIDDEN);
    }

    // Determine content type from requested file extension
    let content_type = if tile_path.ends_with(".json") {
        "application/json"
    } else if tile_path.ends_with(".png") {
        "image/png"
    } else if tile_path.ends_with(".prbm") {
        "application/octet-stream"
    } else {
        "application/octet-stream"
    };

    // Check if requested file exists
    if file_path.exists() {
        // Serve the file directly
        serve_file_internal(file_path, content_type).await
    } else {
        // Try gzipped version (.gz extension)
        let gz_path = file_path.with_extension(
            format!("{}.gz", file_path.extension().and_then(|e| e.to_str()).unwrap_or(""))
        );

        if gz_path.exists() {
            // Serve gzipped file with Content-Encoding header
            serve_gzipped_tile(gz_path, content_type).await
        } else {
            // Tile doesn't exist - this is normal for unrendered areas
            // Only log at debug level to avoid noise
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Serve map assets
pub async fn get_map_asset(
    State(state): State<Arc<BlueMapState>>,
    Path((map_id, asset_path)): Path<(String, String)>,
) -> Result<Response, StatusCode> {
    // Security: validate map_id and asset_path
    if map_id.contains("..") || map_id.contains('/') {
        error!("Invalid map_id: {}", map_id);
        return Err(StatusCode::FORBIDDEN);
    }
    if asset_path.contains("..") {
        error!("Path traversal attempt in asset_path: {}", asset_path);
        return Err(StatusCode::FORBIDDEN);
    }

    let file_path = state.base_path.join("maps").join(&map_id).join("assets").join(&asset_path);

    // Ensure the path is within the expected directory
    let expected_base = state.base_path.join("maps").join(&map_id).join("assets");
    if !file_path.starts_with(&expected_base) {
        error!("Asset path outside expected directory: {:?}", file_path);
        return Err(StatusCode::FORBIDDEN);
    }

    // Determine content type from extension
    let content_type = match file_path.extension().and_then(|e| e.to_str()) {
        Some("json") => "application/json",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        _ => "application/octet-stream",
    };

    serve_file_internal(file_path, content_type).await
}

/// Internal helper to serve files with caching headers
async fn serve_file_internal(file_path: PathBuf, content_type: &str) -> Result<Response, StatusCode> {
    // Check if file exists
    if !file_path.exists() {
        error!("File not found: {:?}", file_path);
        return Err(StatusCode::NOT_FOUND);
    }

    // Read file
    let contents = fs::read(&file_path).await.map_err(|e| {
        error!("Failed to read file {:?}: {}", file_path, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Build response with appropriate headers
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, content_type),
            (header::CACHE_CONTROL, "public, max-age=300"), // 5 minute cache
            (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"), // Allow CORS for launcher WebView
        ],
        contents,
    )
        .into_response())
}

/// Internal helper to serve gzipped tile files with proper encoding headers
async fn serve_gzipped_tile(file_path: PathBuf, content_type: &str) -> Result<Response, StatusCode> {
    // Check if file exists
    if !file_path.exists() {
        error!("Gzipped tile file not found: {:?}", file_path);
        return Err(StatusCode::NOT_FOUND);
    }

    // Read gzipped file
    let contents = fs::read(&file_path).await.map_err(|e| {
        error!("Failed to read gzipped tile {:?}: {}", file_path, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Serve with Content-Encoding: gzip header
    // BlueMap's client expects this to transparently decompress
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, content_type),
            (header::CONTENT_ENCODING, "gzip"),
            (header::CACHE_CONTROL, "public, max-age=300"),
            (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
        ],
        contents,
    )
        .into_response())
}
