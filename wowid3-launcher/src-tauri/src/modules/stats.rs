use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Manager;
use tokio::fs;

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

#[derive(Debug, Serialize, Deserialize)]
struct StatsMetadata {
    hash: String,
    timestamp: u64,
}

pub async fn get_player_stats(
    app_handle: &tauri::AppHandle,
    uuid: &str,
    server_url: &str,
) -> Result<PlayerStats> {
    let cache_dir = app_handle
        .path()
        .app_data_dir()?
        .join("cache")
        .join("player_stats");
    
    fs::create_dir_all(&cache_dir).await?;
    
    let stats_path = cache_dir.join(format!("{}.json", uuid));
    let meta_path = cache_dir.join(format!("{}.meta.json", uuid));
    
    // Load cached hash if exists
    let cached_hash = if meta_path.exists() {
        let meta_content: String = fs::read_to_string(&meta_path).await?;
        let meta: StatsMetadata = serde_json::from_str(&meta_content)?;
        Some(meta.hash)
    } else {
        None
    };

    // Make conditional request
    let client = reqwest::Client::new();
    let url = format!("{}/api/stats/{}", server_url.trim_end_matches('/'), uuid);
    let mut request = client.get(&url);
    
    if let Some(hash) = &cached_hash {
        request = request.header("If-None-Match", hash);
    }

    let response = request.send().await?;

    if response.status() == reqwest::StatusCode::NOT_MODIFIED {
        // Read from cache
        let content: String = fs::read_to_string(&stats_path).await?;
        let stats: PlayerStats = serde_json::from_str(&content)?;
        return Ok(stats);
    }

    if !response.status().is_success() {
        // If offline/error but we have cache, return cache
        if stats_path.exists() {
            let content: String = fs::read_to_string(&stats_path).await?;
            let stats: PlayerStats = serde_json::from_str(&content)?;
            return Ok(stats);
        }
        anyhow::bail!("Failed to fetch stats: {}", response.status());
    }

    // Save new data
    let new_hash = response
        .headers()
        .get("ETag")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.trim_matches('"').to_string())
        .unwrap_or_default();

    let stats_json = response.text().await?;
    let stats: PlayerStats = serde_json::from_str(&stats_json)?;

    // Atomic write
    fs::write(&stats_path, &stats_json).await?;
    
    let meta = StatsMetadata {
        hash: new_hash,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs(),
    };
    fs::write(&meta_path, serde_json::to_string(&meta)?).await?;

    Ok(stats)
}

