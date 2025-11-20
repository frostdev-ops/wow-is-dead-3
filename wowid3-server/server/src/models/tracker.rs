use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerExt {
    pub name: String,
    pub uuid: String,
    pub position: Option<[f64; 3]>, // x, y, z
    pub dimension: Option<String>,  // e.g., "minecraft:overworld"
    pub biome: Option<String>,      // e.g., "minecraft:plains"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub sender: String,
    pub content: String,
    pub timestamp: u64, // Unix timestamp in seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerState {
    pub online_players: Vec<PlayerExt>,
    pub recent_chat: VecDeque<ChatMessage>, // Keep last N messages
    pub tps: Option<f32>,
    pub mspt: Option<f32>,
    pub last_updated: u64, // Unix timestamp
}

impl Default for TrackerState {
    fn default() -> Self {
        Self {
            online_players: Vec::new(),
            recent_chat: VecDeque::with_capacity(50),
            tps: None,
            mspt: None,
            last_updated: 0,
        }
    }
}

// Request models
#[derive(Debug, Deserialize)]
pub struct UpdateStateRequest {
    pub players: Vec<PlayerExt>,
    pub tps: Option<f32>,
    pub mspt: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct ChatMessageRequest {
    pub sender: String,
    pub content: String,
}

