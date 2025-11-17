use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::models::{CommandRequest, CommandResponse, ServerStatus};
use crate::modules::server_manager::ServerManager;

pub fn router() -> Router<Arc<ServerManager>> {
    Router::new()
        .route("/status", get(get_status))
        .route("/start", post(start_server))
        .route("/stop", post(stop_server))
        .route("/restart", post(restart_server))
        .route("/command", post(send_command))
}

async fn get_status(State(manager): State<Arc<ServerManager>>) -> Json<ServerStatus> {
    let state = manager.state().await;
    let started_at = manager.started_at().await;

    let uptime_seconds = if let Some(started) = started_at {
        started.elapsed().ok().map(|d| d.as_secs())
    } else {
        None
    };

    Json(ServerStatus {
        state,
        uptime_seconds,
        started_at,
    })
}

async fn start_server(
    State(manager): State<Arc<ServerManager>>,
) -> Result<Json<Value>, StatusCode> {
    manager
        .start()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "success": true,
        "message": "Server started"
    })))
}

async fn stop_server(
    State(manager): State<Arc<ServerManager>>,
) -> Result<Json<Value>, StatusCode> {
    manager
        .stop()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "success": true,
        "message": "Server stopped"
    })))
}

async fn restart_server(
    State(manager): State<Arc<ServerManager>>,
) -> Result<Json<Value>, StatusCode> {
    manager
        .restart()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "success": true,
        "message": "Server restarted"
    })))
}

async fn send_command(
    State(manager): State<Arc<ServerManager>>,
    Json(req): Json<CommandRequest>,
) -> Result<Json<CommandResponse>, StatusCode> {
    manager
        .send_command(&req.command)
        .await
        .map_err(|e| {
            tracing::error!("Failed to send command: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
        .map(|_| {
            Json(CommandResponse {
                success: true,
                message: "Command sent".to_string(),
            })
        })
}

