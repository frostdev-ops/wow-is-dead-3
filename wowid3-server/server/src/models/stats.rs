use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerStats {
    pub uuid: String,
    pub username: String,
    
    #[serde(default)]
    pub blocks_broken: HashMap<String, u64>,
    #[serde(default)]
    pub blocks_placed: HashMap<String, u64>,
    #[serde(default)]
    pub mobs_killed: HashMap<String, u64>,
    #[serde(default)]
    pub mobs_tamed: HashMap<String, u64>,
    #[serde(default)]
    pub ores_mined: HashMap<String, u64>,
    #[serde(default)]
    pub items_gathered: HashMap<String, u64>,
    
    #[serde(default)]
    pub damage_dealt: f64,
    #[serde(default)]
    pub damage_taken: f64,

    #[serde(default)]
    pub deaths: u64,

    #[serde(default)]
    pub dimensions_visited: Vec<String>,
    #[serde(default)]
    pub biomes_visited: Vec<String>,

    #[serde(default)]
    pub playtime_seconds: u64,

    // Aggregate totals for quick access
    #[serde(default)]
    pub total_blocks_broken: u64,
    #[serde(default)]
    pub total_blocks_placed: u64,
    #[serde(default)]
    pub total_mobs_killed: u64,
    #[serde(default)]
    pub total_mobs_tamed: u64,
    #[serde(default)]
    pub total_ores_mined: u64,
    
    #[serde(default)]
    pub first_seen: u64,
    #[serde(default)]
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StatEvent {
    BlockBroken { item_id: String },
    BlockPlaced { item_id: String },
    MobKilled { entity_id: String },
    MobTamed { entity_id: String },
    OreMined { block_id: String },
    ItemGathered { item_id: String, count: u64 },
    DamageDealt { amount: f64 },
    DamageTaken { amount: f64 },
    PlayerDeath,
    DimensionVisited { dimension_id: String },
    BiomeVisited { biome_id: String },
    Playtime { seconds: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatEventBatch {
    pub events: Vec<PlayerStatEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStatEvent {
    pub uuid: String,
    pub username: String,
    pub timestamp: u64,
    pub event: StatEvent,
}
