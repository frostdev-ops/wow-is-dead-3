use crate::api::public::{AppError, PublicState};
use crate::models::tracker::{ChatMessage, UpdateStateRequest, ChatMessageRequest};
use crate::models::stats::{StatEventBatch, PlayerStats};
use axum::{
    extract::{State, Path},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    Json,
};
use std::time::{SystemTime, UNIX_EPOCH};

const TRACKER_SECRET_HEADER: &str = "x-tracker-secret";
const MAX_CHAT_HISTORY: usize = 50;

/// Middleware-like helper to validate tracker secret
/// Accepts secret in either x-tracker-secret header OR Authorization Bearer header
fn validate_secret(headers: &HeaderMap, expected_secret: &str) -> Result<(), AppError> {
    // Try x-tracker-secret header first (legacy)
    if let Some(secret) = headers.get(TRACKER_SECRET_HEADER).and_then(|h| h.to_str().ok()) {
        if secret == expected_secret {
            return Ok(());
        }
    }

    // Try Authorization Bearer header (new method)
    if let Some(auth) = headers.get(header::AUTHORIZATION).and_then(|h| h.to_str().ok()) {
        if auth.starts_with("Bearer ") {
            let token = &auth[7..]; // Remove "Bearer " prefix
            if token == expected_secret {
                return Ok(());
            }
        }
    }

    Err(AppError::Forbidden("Missing or invalid tracker secret".to_string()))
}

/// POST /api/tracker/update
pub async fn update_tracker_state(
    State(state): State<PublicState>,
    headers: HeaderMap,
    Json(payload): Json<UpdateStateRequest>,
) -> Result<StatusCode, AppError> {
    validate_secret(&headers, &state.config.tracker_secret)?;

    let mut tracker = state.tracker.write().await;

    // Update players and stats
    tracker.online_players = payload.players;
    tracker.tps = payload.tps;
    tracker.mspt = payload.mspt;
    
    // Update timestamp
    let start = SystemTime::now();
    let since_the_epoch = start
        .duration_since(UNIX_EPOCH)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Time error: {}", e)))?;
    tracker.last_updated = since_the_epoch.as_secs();

    Ok(StatusCode::OK)
}

/// POST /api/tracker/chat
pub async fn submit_chat_message(
    State(state): State<PublicState>,
    headers: HeaderMap,
    Json(payload): Json<ChatMessageRequest>,
) -> Result<StatusCode, AppError> {
    validate_secret(&headers, &state.config.tracker_secret)?;

    let mut tracker = state.tracker.write().await;
    
    let start = SystemTime::now();
    let since_the_epoch = start
        .duration_since(UNIX_EPOCH)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Time error: {}", e)))?;

    let message = ChatMessage {
        sender: payload.sender,
        content: payload.content,
        timestamp: since_the_epoch.as_secs(),
    };

    tracker.recent_chat.push_back(message);
    
    // Trim history
    while tracker.recent_chat.len() > MAX_CHAT_HISTORY {
        tracker.recent_chat.pop_front();
    }

    Ok(StatusCode::OK)
}

/// GET /api/tracker/status
pub async fn get_tracker_status(
    State(state): State<PublicState>,
) -> Result<Json<crate::models::tracker::TrackerState>, AppError> {
    let tracker = state.tracker.read().await;
    Ok(Json(tracker.clone()))
}

/// POST /api/tracker/stats-events
pub async fn submit_stat_events(
    State(state): State<PublicState>,
    headers: HeaderMap,
    Json(payload): Json<StatEventBatch>,
) -> Result<StatusCode, AppError> {
    validate_secret(&headers, &state.config.tracker_secret)?;

    for event in payload.events {
        state.stats_processor.push_event(event).await;
    }

    Ok(StatusCode::ACCEPTED)
}

/// GET /api/stats/:uuid
pub async fn get_player_stats(
    State(state): State<PublicState>,
    Path(uuid): Path<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    // Security check: In a real production environment, we should verify the user's token
    // matches the UUID they are requesting, or if they are an admin.
    // For this implementation, we'll assume the launcher handles auth and we trust it,
    // but basic protection is good.

    // Normalize UUID format: add dashes if missing
    // Minecraft UUIDs can be: "adca5752c67a4f0aae7444d9f369f6f8" (32 chars, no dashes)
    // or: "adca5752-c67a-4f0a-ae74-44d9f369f6f8" (36 chars, with dashes)
    let normalized_uuid = if uuid.len() == 32 && !uuid.contains('-') {
        // Add dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        format!(
            "{}-{}-{}-{}-{}",
            &uuid[0..8],
            &uuid[8..12],
            &uuid[12..16],
            &uuid[16..20],
            &uuid[20..32]
        )
    } else {
        uuid.clone()
    };

    // Check for If-None-Match header for caching
    let client_hash = headers
        .get(header::IF_NONE_MATCH)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.trim_matches('"').to_string());

    // Query DB with normalized UUID
    let uuid_clone = normalized_uuid.clone();
    let result = state.db.conn.call(move |conn| {
        conn.query_row(
            "SELECT stats_json, hash FROM player_stats WHERE uuid = ?1",
            [&uuid_clone],
            |row| {
                let json: String = row.get(0)?;
                let hash: String = row.get(1)?;
                Ok((json, hash))
            }
        )
    }).await;

    match result {
        Ok((json, hash)) => {
            // Check cache
            if let Some(client_hash) = client_hash {
                if client_hash == hash {
                    return Ok(StatusCode::NOT_MODIFIED.into_response());
                }
            }

            // Validate JSON is valid PlayerStats (but don't use it to avoid re-serialization)
            let _stats: PlayerStats = serde_json::from_str(&json)
                .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse stats JSON: {}", e)))?;

            // Return with ETag
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header(header::ETAG, format!("\"{}\"", hash))
                .header(header::CONTENT_TYPE, "application/json")
                .body(axum::body::Body::from(json))
                .unwrap())
        },
        Err(tokio_rusqlite::Error::Error(rusqlite::Error::QueryReturnedNoRows)) => {
            // Return empty stats if not found
            let stats = PlayerStats {
                uuid: normalized_uuid.clone(),
                username: "Unknown".to_string(),
                ..Default::default()
            };
            Ok(Json(stats).into_response())
        },
        Err(e) => Err(AppError::Internal(e.into())),
    }
}
