use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerState {
    Stopped,
    Starting,
    Running,
    Stopping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub state: ServerState,
    pub uptime_seconds: Option<u64>,
    pub started_at: Option<SystemTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStats {
    pub status: ServerStatus,
    pub memory_usage_mb: Option<f64>,
    pub cpu_usage_percent: Option<f64>,
    pub player_count: Option<u32>,
    pub max_players: Option<u32>,
    pub tps: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CommandRequest {
    pub command: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandResponse {
    pub success: bool,
    pub message: String,
}

impl Default for ServerStatus {
    fn default() -> Self {
        Self {
            state: ServerState::Stopped,
            uptime_seconds: None,
            started_at: None,
        }
    }
}

impl ServerStatus {
    pub fn update_uptime(&mut self) {
        if let Some(started) = self.started_at {
            if let Ok(elapsed) = started.elapsed() {
                self.uptime_seconds = Some(elapsed.as_secs());
            }
        }
    }

    pub fn uptime_duration(&self) -> Option<Duration> {
        self.uptime_seconds.map(Duration::from_secs)
    }
}

