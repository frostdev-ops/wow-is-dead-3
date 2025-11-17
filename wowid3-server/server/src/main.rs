mod api;
mod models;
mod modules;
mod utils;

use axum::{Router, routing::get};
use dotenv::dotenv;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use modules::config::Config;
use modules::server_manager::ServerManager;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file
    dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "wowid3_server=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env()?;
    tracing::info!("Starting wowid3-server manager");
    tracing::info!("Server directory: {:?}", config.server_dir);
    tracing::info!("API will listen on {}:{}", config.api_host, config.api_port);

    // Create server manager
    let manager = Arc::new(ServerManager::new(config.clone()));

    // Build application
    let app = Router::new()
        .route("/", get(health_check))
        .nest("/api/server", api::server::router())
        .nest("/api/logs", api::logs::router())
        .nest("/api/stats", api::stats::router())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(manager);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.api_port));
    tracing::info!("Server manager API listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

