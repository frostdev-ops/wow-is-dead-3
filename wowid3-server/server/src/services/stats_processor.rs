use crate::models::stats::{PlayerStats, PlayerStatEvent, StatEvent};
use crate::database::Database;
use tokio::sync::mpsc::{self, Sender, Receiver};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use sha2::{Sha256, Digest};
use tokio_rusqlite::Connection;

const BATCH_SIZE: usize = 100;
const FLUSH_INTERVAL: Duration = Duration::from_secs(5);

pub struct StatsProcessor {
    tx: Sender<PlayerStatEvent>,
}

impl StatsProcessor {
    pub fn new(db: Database) -> Self {
        let (tx, rx) = mpsc::channel(10000);
        
        tokio::spawn(async move {
            Self::process_events(rx, db).await;
        });

        Self { tx }
    }

    pub async fn push_event(&self, event: PlayerStatEvent) {
        if let Err(e) = self.tx.send(event).await {
            tracing::error!("Failed to push stat event: {}", e);
        }
    }

    async fn process_events(mut rx: Receiver<PlayerStatEvent>, db: Database) {
        let mut buffer: HashMap<String, Vec<PlayerStatEvent>> = HashMap::new();

        loop {
            tokio::select! {
                Some(event) = rx.recv() => {
                    buffer.entry(event.uuid.clone())
                        .or_default()
                        .push(event);

                    let total_events: usize = buffer.values().map(|v| v.len()).sum();
                    if total_events >= BATCH_SIZE {
                        Self::flush_buffer(&mut buffer, &db).await;
                    }
                }
                _ = tokio::time::sleep(FLUSH_INTERVAL) => {
                    if !buffer.is_empty() {
                        Self::flush_buffer(&mut buffer, &db).await;
                    }
                }
            }
        }
    }

    async fn flush_buffer(buffer: &mut HashMap<String, Vec<PlayerStatEvent>>, db: &Database) {
        for (uuid, events) in buffer.drain() {
            if let Err(e) = Self::update_player_stats(uuid, events, &db.conn).await {
                tracing::error!("Failed to update stats: {}", e);
            }
        }
    }

    async fn update_player_stats(uuid: String, events: Vec<PlayerStatEvent>, conn: &Connection) -> anyhow::Result<()> {
        let uuid_clone = uuid.clone();
        let default_username = events.first().map(|e| e.username.clone()).unwrap_or_default();
        let events_clone = events.clone();
        
        conn.call(move |conn| -> Result<(), rusqlite::Error> {
            let tx = conn.transaction()?;
            
            // 1. Fetch existing stats
            let mut stats: PlayerStats = match tx.query_row(
                "SELECT stats_json FROM player_stats WHERE uuid = ?1",
                [&uuid_clone],
                |row| {
                    let json: String = row.get(0)?;
                    Ok(serde_json::from_str(&json).unwrap_or_default())
                }
            ) {
                Ok(stats) => stats,
                Err(rusqlite::Error::QueryReturnedNoRows) => PlayerStats {
                    uuid: uuid_clone.clone(),
                    username: default_username.clone(),
                    first_seen: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
                    ..Default::default()
                },
                Err(e) => return Err(e),
            };

            // 2. Apply updates
            for event in events_clone {
                // Update username if changed
                if !event.username.is_empty() {
                    stats.username = event.username;
                }
                
                match event.event {
                    StatEvent::BlockBroken { item_id } => {
                        *stats.blocks_broken.entry(item_id).or_insert(0) += 1;
                        stats.total_blocks_broken += 1;
                    }
                    StatEvent::BlockPlaced { item_id } => {
                        *stats.blocks_placed.entry(item_id).or_insert(0) += 1;
                        stats.total_blocks_placed += 1;
                    }
                    StatEvent::MobKilled { entity_id } => {
                        *stats.mobs_killed.entry(entity_id).or_insert(0) += 1;
                        stats.total_mobs_killed += 1;
                    }
                    StatEvent::MobTamed { entity_id } => {
                        *stats.mobs_tamed.entry(entity_id).or_insert(0) += 1;
                        stats.total_mobs_tamed += 1;
                    }
                    StatEvent::OreMined { block_id } => {
                        *stats.ores_mined.entry(block_id).or_insert(0) += 1;
                        stats.total_ores_mined += 1;
                    }
                    StatEvent::ItemGathered { item_id, count } => {
                        *stats.items_gathered.entry(item_id).or_insert(0) += count;
                    }
                    StatEvent::DamageDealt { amount } => {
                        stats.damage_dealt += amount;
                    }
                    StatEvent::DamageTaken { amount } => {
                        stats.damage_taken += amount;
                    }
                    StatEvent::PlayerDeath => {
                        stats.deaths += 1;
                    }
                    StatEvent::DimensionVisited { dimension_id } => {
                        if !stats.dimensions_visited.contains(&dimension_id) {
                            stats.dimensions_visited.push(dimension_id);
                        }
                    }
                    StatEvent::BiomeVisited { biome_id } => {
                        if !stats.biomes_visited.contains(&biome_id) {
                            stats.biomes_visited.push(biome_id);
                        }
                    }
                    StatEvent::Playtime { seconds } => {
                        stats.playtime_seconds += seconds;
                    }
                }
            }

            // 3. Update timestamp and hash
            stats.last_updated = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
            
            let json = serde_json::to_string(&stats).unwrap();
            let hash = format!("{:x}", Sha256::digest(json.as_bytes()));

            // 4. Save back to DB
            tx.execute(
                "INSERT INTO player_stats (uuid, stats_json, hash, last_updated) 
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(uuid) DO UPDATE SET 
                    stats_json = excluded.stats_json,
                    hash = excluded.hash,
                    last_updated = excluded.last_updated",
                (uuid_clone, json, hash, stats.last_updated),
            )?;

            tx.commit()?;
            Ok(())
        }).await?;

        Ok(())
    }
}

