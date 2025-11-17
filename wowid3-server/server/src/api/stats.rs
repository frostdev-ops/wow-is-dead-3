use axum::{
    extract::State,
    response::Json,
    routing::get,
    Router,
};
use sysinfo::{System, Pid};
use std::sync::Arc;

use crate::models::{ServerStats, ServerStatus};
use crate::modules::server_manager::ServerManager;

pub fn router() -> Router<Arc<ServerManager>> {
    Router::new().route("/", get(get_stats))
}

async fn get_stats(State(manager): State<Arc<ServerManager>>) -> Json<ServerStats> {
    let state = manager.state().await;
    let started_at = manager.started_at().await;

    let uptime_seconds = if let Some(started) = started_at {
        started.elapsed().ok().map(|d| d.as_secs())
    } else {
        None
    };

    let status = ServerStatus {
        state,
        uptime_seconds,
        started_at,
    };

    // Try to get process stats
    let mut system = System::new();
    system.refresh_all();

    let (memory_mb, cpu_percent) = if let Some(pid) = manager.pid().await {
        system.refresh_all();
        if let Some(process) = system.process(Pid::from(pid as usize)) {
            (
                Some(process.memory() as f64 / 1024.0 / 1024.0), // Convert to MB
                Some(process.cpu_usage() as f64),
            )
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    Json(ServerStats {
        status,
        memory_usage_mb: memory_mb,
        cpu_usage_percent: cpu_percent,
        player_count: None, // TODO: Parse from server logs or use RCON
        max_players: None,
        tps: None, // TODO: Parse from server logs
    })
}

