mod api;
mod config;
mod models;
mod storage;

use api::public::{get_latest_manifest, get_manifest_by_version, serve_file, PublicState};
use axum::{
    response::Json,
    routing::get,
    Router,
};
use config::Config;
use serde_json::json;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    // Load configuration
    let config = Config::from_env()?;
    info!("Loaded configuration");
    info!("Storage path: {:?}", config.storage_path());
    info!("API listening on {}:{}", config.api_host, config.api_port);

    // Create storage directories
    tokio::fs::create_dir_all(config.releases_path()).await?;
    tokio::fs::create_dir_all(config.uploads_path()).await?;
    info!("Storage directories initialized");

    // Create shared state for public API
    let public_state = PublicState {
        config: Arc::new(config.clone()),
    };

    // Build CORS layer
    let cors = if let Some(origin) = &config.cors_origin {
        CorsLayer::permissive() // Dev mode
            .allow_origin(origin.parse::<http::HeaderValue>().unwrap())
    } else {
        CorsLayer::permissive() // Production
    };

    // Build public API router
    let api_routes = Router::new()
        .route("/api/manifest/latest", get(get_latest_manifest))
        .route("/api/manifest/:version", get(get_manifest_by_version))
        .route("/files/:version/*path", get(serve_file))
        .with_state(public_state);

    // Build main router
    let app = Router::new()
        .route("/health", get(health_check))
        .merge(api_routes)
        .layer(cors);

    // Start server
    let addr = format!("{}:{}", config.api_host, config.api_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Server running on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "wowid3-modpack-server"
    }))
}
