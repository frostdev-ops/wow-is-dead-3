mod api;
mod cache;
mod cli;
mod config;
mod database;
mod middleware;
mod models;
mod services;
mod storage;
mod tcp_test_server;
mod utils;
mod vpn;

use api::admin::{
    clear_cache, clear_jar_cache, clear_manifest_cache, copy_release_to_draft, create_release,
    delete_release, delete_resource, get_blacklist, get_cache_stats, list_releases, login,
    update_blacklist, upload_files, upload_resource, upload_launcher_release,
    upload_launcher_version_file, delete_launcher_version, create_launcher_release,
    list_launcher_releases, AdminState as AdminApiState,
};
use api::bluemap::{
    get_global_settings, get_live_markers, get_live_players, get_map_asset, get_map_settings,
    get_map_textures, get_map_textures_gz, get_map_tile, serve_webapp_file, BlueMapState,
};
use api::drafts::{
    add_files, analyze_draft, browse_directory, create_directory, create_draft, delete_draft,
    duplicate_draft, generate_changelog_for_draft, get_draft, list_drafts, move_file,
    publish_draft, read_file_content, remove_file, rename_file, update_draft, update_file,
    write_file_content,
};
use api::public::{
    get_latest_manifest, get_manifest_by_version, list_resources, serve_audio_file, serve_file,
    serve_java_runtime, serve_resource, serve_launcher_file,
    serve_versioned_launcher_file, get_launcher_versions, get_launcher_version,
    get_latest_launcher_redirect, get_launcher_installer, get_launcher_installer_platform,
    get_launcher_executable, get_launcher_executable_platform, PublicState,
};
use api::tracker::{get_tracker_status, submit_chat_message, update_tracker_state, submit_stat_events, get_player_stats};
use axum::{
    extract::DefaultBodyLimit,
    middleware as axum_middleware,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use clap::Parser;
use cli::Cli;
use config::Config;
use database::Database;
use middleware::auth::auth_middleware;
use models::tracker::TrackerState;
use services::stats_processor::StatsProcessor;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;
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

    // Parse CLI arguments
    let cli = Cli::parse();

    // Load configuration
    let config = Config::from_env()?;

    // Check if a CLI command was provided
    if cli.command.is_some() {
        // Run CLI command and exit
        cli::run_cli(cli, config).await?;
        return Ok(());
    }

    // No CLI command, start the web server
    info!("Loaded configuration");
    info!("Storage path: {:?}", config.storage_path());
    info!("API listening on {}:{}", config.api_host, config.api_port);

    // Create storage directories
    tokio::fs::create_dir_all(config.releases_path()).await?;
    tokio::fs::create_dir_all(config.uploads_path()).await?;
    tokio::fs::create_dir_all(config.resources_path()).await?;
    tokio::fs::create_dir_all(config.launcher_path()).await?;
    tokio::fs::create_dir_all(config.storage_path().join("drafts")).await?;
    tokio::fs::create_dir_all(config.storage_path().join("assets")).await?;
    info!("Storage directories initialized");

    // Initialize database connection pool
    let db_path = config.storage_path().join("stats.db");
    let db = Database::new(&db_path).await?;
    db.init_schema().await?;
    info!("Database initialized at {:?}", db_path);

    let config_arc = Arc::new(config.clone());

    // Initialize cache manager
    let cache_manager = cache::CacheManager::new();
    info!("Cache manager initialized");

    // Initialize tracker state
    let tracker_state = Arc::new(RwLock::new(TrackerState::default()));
    info!("Tracker state initialized");

    // Initialize stats processor
    let stats_processor = Arc::new(StatsProcessor::new(db.clone()));
    info!("Stats processor initialized");

    // Create shared state for public API
    let public_state = PublicState {
        config: config_arc.clone(),
        cache: cache_manager.clone(),
        tracker: tracker_state.clone(),
        db: db.clone(),
        stats_processor: stats_processor.clone(),
    };

    // Create shared state for admin API
    let admin_password = std::env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "changeme".to_string());
    let admin_state = AdminApiState {
        config: config_arc.clone(),
        admin_password: Arc::new(admin_password),
        cache: cache_manager.clone(),
    };

    // Create shared state for BlueMap API
    let bluemap_state = Arc::new(BlueMapState::new());
    info!("BlueMap state initialized");

    // Create shared state for VPN API
    let ip_allocator = Arc::new(vpn::IpAllocator::new(db.conn.clone()));
    let vpn_state = vpn::api::VpnState {
        db: db.clone(),
        ip_allocator,
    };
    info!("VPN state initialized");

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
        // Launcher endpoints
        .route("/api/launcher/latest", get(get_latest_launcher_redirect))
        .route("/api/launcher/latest/installer", get(get_launcher_installer))
        .route("/api/launcher/latest/installer/:platform", get(get_launcher_installer_platform))
        .route("/api/launcher/latest/executable", get(get_launcher_executable))
        .route("/api/launcher/latest/executable/:platform", get(get_launcher_executable_platform))
        .route("/api/launcher/versions", get(get_launcher_versions))
        .route("/api/launcher/:version", get(get_launcher_version))
        .route("/api/assets/:filename", get(serve_audio_file))
        .route("/api/java/:filename", get(serve_java_runtime))
        .route("/api/resources", get(list_resources))
        .route("/api/resources/:filename", get(serve_resource))
        .route("/files/:version/*path", get(serve_file))
        .route("/files/launcher/:filename", get(serve_launcher_file))
        .route("/files/launcher/versions/:version/:filename", get(serve_versioned_launcher_file))
        // Tracker routes
        .route("/api/tracker/update", post(update_tracker_state))
        .route("/api/tracker/chat", post(submit_chat_message))
        .route("/api/tracker/status", get(get_tracker_status))
        .route("/api/tracker/stats-events", post(submit_stat_events))
        .route("/api/stats/:uuid", get(get_player_stats))
        .with_state(public_state);

    // Build BlueMap maps router (shared by both paths)
    let bluemap_maps_routes = Router::new()
        .route("/maps/:map_id/settings.json", get(get_map_settings))
        .route("/maps/:map_id/textures.json", get(get_map_textures))
        .route("/maps/:map_id/textures.json.gz", get(get_map_textures_gz))
        .route("/maps/:map_id/live/markers.json", get(get_live_markers))
        .route("/maps/:map_id/live/players.json", get(get_live_players))
        .route("/maps/:map_id/tiles/*tile_path", get(get_map_tile))
        .route("/maps/:map_id/assets/*asset_path", get(get_map_asset))
        .with_state(bluemap_state.clone());

    // Build BlueMap API router
    // IMPORTANT: Wildcard route MUST come before nest() for specific routes to take priority
    let bluemap_routes = Router::new()
        .route("/api/bluemap/settings.json", get(get_global_settings))
        .route("/api/bluemap/webapp/*path", get(serve_webapp_file))
        .nest("/api/bluemap", bluemap_maps_routes.clone())
        .nest("/api/bluemap/webapp", bluemap_maps_routes)
        .with_state(bluemap_state);

    // Admin login route (no auth required)
    let admin_login = Router::new()
        .route("/api/admin/login", post(login))
        .with_state(admin_state.clone());

    // Build admin API router (with auth middleware)
    let admin_routes = Router::new()
        .route("/api/admin/upload", post(upload_files))
        .route("/api/admin/launcher", post(upload_launcher_release))
        .route("/api/admin/launcher/releases", post(create_launcher_release).get(list_launcher_releases))
        .route("/api/admin/launcher/version", post(upload_launcher_version_file))
        .route("/api/admin/launcher/:version", delete(delete_launcher_version))
        .route("/api/admin/resources", post(upload_resource))
        .route("/api/admin/resources/:filename", delete(delete_resource))
        .route("/api/admin/releases", post(create_release).get(list_releases))
        .route("/api/admin/releases/:version/copy-to-draft", post(copy_release_to_draft))
        .route("/api/admin/releases/:version", delete(delete_release))
        .route("/api/admin/blacklist", get(get_blacklist).put(update_blacklist))
        // Cache management routes
        .route("/api/admin/cache/stats", get(get_cache_stats))
        .route("/api/admin/cache/clear", post(clear_cache))
        .route("/api/admin/cache/clear/manifests", post(clear_manifest_cache))
        .route("/api/admin/cache/clear/jar", post(clear_jar_cache))
        // Draft management routes
        .route("/api/admin/drafts", post(create_draft).get(list_drafts))
        .route("/api/admin/drafts/:id", get(get_draft).put(update_draft).delete(delete_draft))
        .route("/api/admin/drafts/:id/analyze", post(analyze_draft))
        .route("/api/admin/drafts/:id/files", post(add_files))
        .route("/api/admin/drafts/:id/files/*path", delete(remove_file).put(update_file))
        .route("/api/admin/drafts/:id/generate-changelog", post(generate_changelog_for_draft))
        .route("/api/admin/drafts/:id/publish", post(publish_draft))
        .route("/api/admin/drafts/:id/duplicate", post(duplicate_draft))
        // File browser routes
        .route("/api/admin/drafts/:id/browse", get(browse_directory))
        .route("/api/admin/drafts/:id/read-file", get(read_file_content))
        .route("/api/admin/drafts/:id/write-file", post(write_file_content))
        .route("/api/admin/drafts/:id/create-dir", post(create_directory))
        .route("/api/admin/drafts/:id/rename", post(rename_file))
        .route("/api/admin/drafts/:id/move", post(move_file))
        .layer(axum_middleware::from_fn(auth_middleware))
        .with_state(admin_state);

    // Build main router
    let app = Router::new()
        .route("/health", get(health_check))
        .merge(public_routes)
        .merge(bluemap_routes)
        .merge(admin_login)
        .merge(admin_routes)
        .merge(vpn::api::vpn_public_routes(vpn_state.clone()))
        .merge(vpn::api::vpn_admin_routes(vpn_state))
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024 * 1024)) // 20GB limit
        .layer(cors);

    // Start TCP test server on port 25567
    let tcp_test_server = tcp_test_server::TcpTestServer::new(25567);
    tokio::spawn(async move {
        if let Err(e) = tcp_test_server.run().await {
            tracing::error!("TCP test server error: {}", e);
        }
    });
    info!("TCP test server started on port 25567");

    // Start HTTP server
    let addr = format!("{}:{}", config.api_host, config.api_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("HTTP server running on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "wowid3-modpack-server"
    }))
}
