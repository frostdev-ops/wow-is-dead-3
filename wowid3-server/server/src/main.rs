mod api;
mod config;
mod middleware;
mod models;
mod services;
mod storage;
mod utils;

use api::admin::{
    create_release, delete_release, get_blacklist, list_releases, login, update_blacklist,
    upload_files, AdminState as AdminApiState,
};
use api::drafts::{
    add_files, analyze_draft, create_draft, delete_draft, generate_changelog_for_draft,
    get_draft, list_drafts, publish_draft, remove_file, update_draft, update_file,
};
use api::public::{get_latest_manifest, get_manifest_by_version, serve_file, serve_java_runtime, PublicState};
use axum::{
    middleware as axum_middleware,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use config::Config;
use middleware::auth::auth_middleware;
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
    tokio::fs::create_dir_all(config.storage_path().join("drafts")).await?;
    info!("Storage directories initialized");

    let config_arc = Arc::new(config.clone());

    // Create shared state for public API
    let public_state = PublicState {
        config: config_arc.clone(),
    };

    // Create shared state for admin API
    let admin_password = std::env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "changeme".to_string());
    let admin_state = AdminApiState {
        config: config_arc.clone(),
        admin_password: Arc::new(admin_password),
    };

    // Build CORS layer
    let cors = if let Some(origin) = &config.cors_origin {
        CorsLayer::permissive() // Dev mode
            .allow_origin(origin.parse::<http::HeaderValue>().unwrap())
    } else {
        CorsLayer::permissive() // Production
    };

    // Build public API router
    let public_routes = Router::new()
        .route("/api/manifest/latest", get(get_latest_manifest))
        .route("/api/manifest/:version", get(get_manifest_by_version))
        .route("/api/java/:filename", get(serve_java_runtime))
        .route("/files/:version/*path", get(serve_file))
        .with_state(public_state);

    // Admin login route (no auth required)
    let admin_login = Router::new()
        .route("/api/admin/login", post(login))
        .with_state(admin_state.clone());

    // Build admin API router (with auth middleware)
    let admin_routes = Router::new()
        .route("/api/admin/upload", post(upload_files))
        .route("/api/admin/releases", post(create_release).get(list_releases))
        .route("/api/admin/releases/:version", delete(delete_release))
        .route("/api/admin/blacklist", get(get_blacklist).put(update_blacklist))
        // Draft management routes
        .route("/api/admin/drafts", post(create_draft).get(list_drafts))
        .route("/api/admin/drafts/:id", get(get_draft).put(update_draft).delete(delete_draft))
        .route("/api/admin/drafts/:id/analyze", post(analyze_draft))
        .route("/api/admin/drafts/:id/files", post(add_files))
        .route("/api/admin/drafts/:id/files/*path", delete(remove_file).put(update_file))
        .route("/api/admin/drafts/:id/generate-changelog", post(generate_changelog_for_draft))
        .route("/api/admin/drafts/:id/publish", post(publish_draft))
        .layer(axum_middleware::from_fn(auth_middleware))
        .with_state(admin_state);

    // Build main router
    let app = Router::new()
        .route("/health", get(health_check))
        .merge(public_routes)
        .merge(admin_login)
        .merge(admin_routes)
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
