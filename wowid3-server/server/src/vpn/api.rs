use axum::{
    extract::{State, Json},
    http::StatusCode,
    Router, routing::post,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::database::Database;
use super::{manager::WireGuardManager, provisioner::IpAllocator};

#[derive(Clone)]
pub struct VpnState {
    pub db: Database,
    pub ip_allocator: Arc<IpAllocator>,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub minecraft_uuid: String,
    pub minecraft_username: String,
    pub public_key: String,
    pub auth_token: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub success: bool,
    pub assigned_ip: String,
    pub server_public_key: String,
    pub endpoint: String,
}

pub async fn register_peer(
    State(state): State<VpnState>,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<RegisterResponse>), (StatusCode, String)> {
    // TODO: Validate Microsoft token with Mojang API
    // For now, accept any token (basic validation placeholder)
    if req.auth_token.is_empty() {
        return Err((StatusCode::UNAUTHORIZED, "Missing auth token".to_string()));
    }

    // Check if peer already exists by UUID
    let existing = state.db.conn.call({
        let uuid = req.minecraft_uuid.clone();
        move |conn| {
            conn.query_row(
                "SELECT ip_address, public_key FROM vpn_peers WHERE uuid = ?1 AND revoked = 0",
                [&uuid],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            )
        }
    }).await;

    let assigned_ip = match existing {
        Ok((ip, old_key)) => {
            // Peer exists, check if public key changed
            if old_key != req.public_key {
                // Remove old public key from WireGuard
                if let Err(e) = WireGuardManager::remove_peer(&old_key) {
                    eprintln!("Warning: Failed to remove old WireGuard peer: {}", e);
                }

                // Update public key in database
                state.db.conn.call({
                    let uuid = req.minecraft_uuid.clone();
                    let username = req.minecraft_username.clone();
                    let public_key = req.public_key.clone();
                    let now = chrono::Utc::now().timestamp();
                    move |conn| {
                        conn.execute(
                            "UPDATE vpn_peers SET public_key = ?1, username = ?2, registered_at = ?3 WHERE uuid = ?4",
                            rusqlite::params![&public_key, &username, &now, &uuid]
                        )
                    }
                }).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;
            }

            ip
        }
        Err(_) => {
            // New peer, allocate IP
            let ip = state.ip_allocator
                .next_available_ip()
                .await
                .map_err(|e| (StatusCode::SERVICE_UNAVAILABLE, e.to_string()))?;

            // Insert into database
            state.db.conn.call({
                let uuid = req.minecraft_uuid.clone();
                let username = req.minecraft_username.clone();
                let public_key = req.public_key.clone();
                let ip_clone = ip.clone();
                let now = chrono::Utc::now().timestamp();
                move |conn| {
                    conn.execute(
                        "INSERT INTO vpn_peers (uuid, username, public_key, ip_address, registered_at)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![&uuid, &username, &public_key, &ip_clone, &now]
                    )
                }
            }).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

            ip
        }
    };

    // Add peer to WireGuard
    WireGuardManager::add_peer(&req.public_key, &assigned_ip)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("WireGuard error: {}", e)))?;

    // Get server public key
    let server_pubkey = WireGuardManager::get_server_public_key()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to read server key: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(RegisterResponse {
            success: true,
            assigned_ip,
            server_public_key: server_pubkey,
            endpoint: "wowid-launcher.frostdev.io:51820".to_string(),
        }),
    ))
}

pub fn vpn_routes(state: VpnState) -> Router {
    Router::new()
        .route("/api/vpn/register", post(register_peer))
        .with_state(state)
}
