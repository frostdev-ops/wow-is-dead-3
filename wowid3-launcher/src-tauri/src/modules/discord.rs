use anyhow::{anyhow, Result};
use discord_rich_presence::activity::{Activity, Assets, Party, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

/// Discord application ID for WOWID3 Launcher
///
/// To get your own Application ID:
/// 1. Go to https://discord.com/developers/applications
/// 2. Click "New Application" and name it "WOW Is Dead 3!"
/// 3. Copy the "Application ID" from General Information
/// 4. Go to Rich Presence → Art Assets and upload:
///    - Large icon named "wowid3-logo" (main launcher/server branding)
///    - Small icons: "grass_block", "netherrack", "end_stone" (dimension indicators)
/// 5. Replace the placeholder below with your real Application ID
const DISCORD_APP_ID: &str = "1251233593062068315";

/// Discord RPC client manager
#[derive(Clone)]
pub struct DiscordClient {
    /// The underlying Discord RPC client, wrapped in Arc<Mutex<>> for thread safety
    client: Arc<Mutex<Option<DiscordIpcClient>>>,
}

impl DiscordClient {
    /// Create a new Discord RPC client
    pub fn new() -> Self {
        DiscordClient {
            client: Arc::new(Mutex::new(None)),
        }
    }

    /// Initialize Discord connection
    pub async fn connect(&self) -> Result<()> {
        // Run the connection in a blocking task since DiscordIpc is blocking
        let app_id = DISCORD_APP_ID.to_string();
        let client = self.client.clone();

        tokio::task::spawn_blocking(move || {
            match DiscordIpcClient::new(&app_id) {
                Ok(mut discord_client) => {
                    // Try to connect
                    match discord_client.connect() {
                        Ok(_) => {
                            // Successfully connected
                            if let Ok(mut guard) = client.lock() {
                                *guard = Some(discord_client);
                            }
                            Ok::<(), anyhow::Error>(())
                        }
                        Err(e) => {
                            // Discord not running
                            Err(anyhow!(
                                "Failed to connect to Discord. Is Discord running? Error: {}",
                                e
                            ))
                        }
                    }
                }
                Err(e) => {
                    Err(anyhow!(
                        "Failed to create Discord IPC client: {}",
                        e
                    ))
                }
            }
        })
        .await
        .map_err(|e| anyhow!("Connection task failed: {}", e))?
    }

    /// Set presence when game launches
    pub async fn set_presence(&self, presence: &GamePresence) -> Result<()> {
        let client = self.client.clone();
        let presence = presence.clone();

        tokio::task::spawn_blocking(move || {
            let mut guard = client.lock().map_err(|e| anyhow!("Lock poisoned: {}", e))?;

            match &mut *guard {
                Some(discord_client) => {
                    // Build the activity using builder pattern
                    let mut activity = Activity::new().state(&presence.state);

                    // Add details if provided
                    if let Some(details) = &presence.details {
                        activity = activity.details(details);
                    }

                    // Add assets (images)
                    let mut assets = Assets::new();
                    let mut has_assets = false;

                    if let Some(large_image) = &presence.large_image {
                        assets = assets.large_image(large_image);
                        has_assets = true;
                    }
                    if let Some(large_text) = &presence.large_image_text {
                        assets = assets.large_text(large_text);
                        has_assets = true;
                    }
                    if let Some(small_image) = &presence.small_image {
                        assets = assets.small_image(small_image);
                        has_assets = true;
                    }
                    if let Some(small_text) = &presence.small_image_text {
                        assets = assets.small_text(small_text);
                        has_assets = true;
                    }

                    if has_assets {
                        activity = activity.assets(assets);
                    }

                    // Add timestamps
                    if let Some(start_time) = presence.start_time {
                        activity = activity.timestamps(Timestamps::new().start(start_time));
                    } else if let Some(end_time) = presence.end_time {
                         activity = activity.timestamps(Timestamps::new().end(end_time));
                    }

                    // Add party info
                    if let (Some(size), Some(max)) = (presence.party_size, presence.party_max) {
                        activity = activity.party(Party::new().size([size as i32, max as i32]));
                    }

                    discord_client.set_activity(activity)
                        .map_err(|e| anyhow!("Failed to set Discord activity: {}", e))?;
                    Ok(())
                }
                None => {
                    Err(anyhow!(
                        "Discord client not connected. Call connect() first."
                    ))
                }
            }
        })
        .await
        .map_err(|e| anyhow!("Set presence task failed: {}", e))?
    }

    /// Update presence with new server information
    pub async fn update_presence(&self, presence: &GamePresence) -> Result<()> {
        self.set_presence(presence).await
    }

    /// Clear presence when game closes
    pub async fn clear_presence(&self) -> Result<()> {
        let client = self.client.clone();

        tokio::task::spawn_blocking(move || {
            let mut guard = client.lock().map_err(|e| anyhow!("Lock poisoned: {}", e))?;

            match &mut *guard {
                Some(discord_client) => {
                    // Use the clear_activity method provided by the library
                    discord_client.clear_activity()
                        .map_err(|e| anyhow!("Failed to clear Discord activity: {}", e))?;
                    Ok(())
                }
                None => {
                    // Not connected, so nothing to clear
                    Ok(())
                }
            }
        })
        .await
        .map_err(|e| anyhow!("Clear presence task failed: {}", e))?
    }

    /// Disconnect from Discord
    pub async fn disconnect(&self) -> Result<()> {
        let client = self.client.clone();

        tokio::task::spawn_blocking(move || {
            let mut guard = client.lock().map_err(|e| anyhow!("Lock poisoned: {}", e))?;

            if let Some(mut discord_client) = guard.take() {
                let _ = discord_client.close();
            }

            Ok(())
        })
        .await
        .map_err(|e| anyhow!("Disconnect task failed: {}", e))?
    }

    /// Check if Discord is connected
    pub async fn is_connected(&self) -> bool {
        self.client
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }
}

/// Game presence information for Discord
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePresence {
    /// Current game state (e.g., "Playing WOW Is Dead 3!")
    pub state: String,
    /// Details about what the user is doing (e.g., "Server: WOWID3")
    pub details: Option<String>,
    /// Large image asset (e.g., "wowid3-logo")
    pub large_image: Option<String>,
    /// Text for large image hover
    pub large_image_text: Option<String>,
    /// Small image asset (e.g., server status icon)
    pub small_image: Option<String>,
    /// Text for small image hover
    pub small_image_text: Option<String>,
    /// Unix timestamp when activity started
    pub start_time: Option<i64>,
    /// Unix timestamp when activity ends
    pub end_time: Option<i64>,
    /// Current party size (players online)
    pub party_size: Option<u32>,
    /// Max party size (max players)
    pub party_max: Option<u32>,
    /// Deprecated: Use party_size instead
    pub player_count: Option<u32>,
}

impl Default for GamePresence {
    fn default() -> Self {
        GamePresence {
            state: "Playing WOW Is Dead 3!".to_string(),
            details: None,
            large_image: Some("wowid3-logo".to_string()),
            large_image_text: Some("WOW Is Dead 3!".to_string()),
            small_image: None,
            small_image_text: None,
            start_time: None,
            end_time: None,
            party_size: None,
            party_max: None,
            player_count: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_game_presence_default() {
        let presence = GamePresence::default();
        assert_eq!(presence.state, "Playing WOW Is Dead 3!");
        assert_eq!(presence.details, None);
        assert_eq!(presence.party_size, None);
    }

    #[test]
    fn test_game_presence_with_details() {
        let presence = GamePresence {
            state: "Playing WOW Is Dead 3!".to_string(),
            details: Some("Server: WOWID3 [5/32 Players]".to_string()),
            large_image: Some("wowid3-logo".to_string()),
            large_image_text: Some("WOW Is Dead 3!".to_string()),
            small_image: Some("online".to_string()),
            small_image_text: Some("Server Online".to_string()),
            start_time: Some(1700000000),
            end_time: None,
            party_size: Some(5),
            party_max: Some(32),
            player_count: None,
        };

        assert_eq!(presence.state, "Playing WOW Is Dead 3!");
        assert_eq!(
            presence.details,
            Some("Server: WOWID3 [5/32 Players]".to_string())
        );
        assert_eq!(presence.party_size, Some(5));
        assert_eq!(presence.party_max, Some(32));
        assert_eq!(presence.large_image, Some("wowid3-logo".to_string()));
    }

    #[test]
    fn test_discord_client_creation() {
        let client = DiscordClient::new();
        let _client_clone = client.clone();
        // Should create successfully
        assert!(true); // Just ensure no panics
    }

    #[tokio::test]
    async fn test_discord_client_not_connected_initially() {
        let client = DiscordClient::new();
        assert!(!client.is_connected().await);
    }

    #[tokio::test]
    async fn test_clear_presence_when_not_connected() {
        // Should not error even if not connected
        let client = DiscordClient::new();
        let result = client.clear_presence().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_disconnect_when_not_connected() {
        // Should not error even if not connected
        let client = DiscordClient::new();
        let result = client.disconnect().await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_game_presence_serialization() {
        let presence = GamePresence {
            state: "Playing WOW Is Dead 3!".to_string(),
            details: Some("Server: WOWID3 [5/32 Players]".to_string()),
            large_image: Some("wowid3-logo".to_string()),
            large_image_text: Some("WOW Is Dead 3!".to_string()),
            small_image: Some("online".to_string()),
            small_image_text: Some("Server Online".to_string()),
            start_time: Some(1700000000),
            end_time: None,
            party_size: Some(5),
            party_max: Some(32),
            player_count: None,
        };

        let json = serde_json::to_string(&presence).unwrap();
        assert!(json.contains("Playing WOW Is Dead 3!"));
        assert!(json.contains("Server: WOWID3"));
        assert!(json.contains("5"));
        assert!(json.contains("32"));
    }

    #[test]
    fn test_game_presence_deserialization() {
        let json = r#"
        {
            "state": "Playing WOW Is Dead 3!",
            "details": "Server: WOWID3 [5/32 Players]",
            "large_image": "wowid3-logo",
            "large_image_text": "WOW Is Dead 3!",
            "small_image": "online",
            "small_image_text": "Server Online",
            "start_time": 1700000000,
            "end_time": null,
            "party_size": 5,
            "party_max": 32
        }
        "#;

        let presence: GamePresence = serde_json::from_str(json).unwrap();
        assert_eq!(presence.state, "Playing WOW Is Dead 3!");
        assert_eq!(presence.party_size, Some(5));
        assert_eq!(presence.party_max, Some(32));
    }

    #[test]
    fn test_game_presence_minimal() {
        let presence = GamePresence {
            state: "Playing WOW Is Dead 3!".to_string(),
            details: None,
            large_image: None,
            large_image_text: None,
            small_image: None,
            small_image_text: None,
            start_time: None,
            end_time: None,
            party_size: None,
            party_max: None,
            player_count: None,
        };

        assert_eq!(presence.state, "Playing WOW Is Dead 3!");
        assert!(presence.large_image.is_none());
    }

    #[test]
    fn test_game_presence_with_timestamps() {
        let presence = GamePresence {
            state: "Playing WOW Is Dead 3!".to_string(),
            details: Some("Server: WOWID3".to_string()),
            large_image: None,
            large_image_text: None,
            small_image: None,
            small_image_text: None,
            start_time: Some(1700000000),
            end_time: Some(1700003600),
            party_size: None,
            party_max: None,
            player_count: None,
        };

        assert_eq!(presence.start_time, Some(1700000000));
        assert_eq!(presence.end_time, Some(1700003600));
    }
}
