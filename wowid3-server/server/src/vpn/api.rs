use axum::{
    extract::{Path, State, Json},
    http::StatusCode,
    Router, routing::{get, post, delete},
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

#[derive(Serialize)]
pub struct PeerInfo {
    pub uuid: String,
    pub username: String,
    pub ip_address: String,
    pub online: bool,
    pub last_handshake: Option<i64>,
}

/// List all non-revoked VPN peers (admin only)
pub async fn list_peers(
    State(state): State<VpnState>,
) -> Result<(StatusCode, Json<Vec<PeerInfo>>), (StatusCode, String)> {
    // Query all non-revoked peers from database
    let peers = state.db.conn.call(|conn| {
        let mut stmt = conn.prepare(
            "SELECT uuid, username, ip_address, last_handshake
             FROM vpn_peers
             WHERE revoked = 0
             ORDER BY username ASC"
        )?;

        let peer_iter = stmt.query_map([], |row| {
            let last_handshake: Option<i64> = row.get(3).ok();
            let now = chrono::Utc::now().timestamp();

            // Peer is online if last handshake was within last 3 minutes
            let online = last_handshake
                .map(|ts| now - ts < 180)
                .unwrap_or(false);

            Ok(PeerInfo {
                uuid: row.get(0)?,
                username: row.get(1)?,
                ip_address: row.get(2)?,
                online,
                last_handshake,
            })
        })?;

        let mut peers = Vec::new();
        for peer_result in peer_iter {
            peers.push(peer_result?);
        }

        Ok::<Vec<PeerInfo>, rusqlite::Error>(peers)
    }).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok((StatusCode::OK, Json(peers)))
}

/// Revoke a VPN peer's access (admin only)
pub async fn revoke_peer(
    State(state): State<VpnState>,
    Path(uuid): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Get peer's public key from database
    let public_key = state.db.conn.call({
        let uuid = uuid.clone();
        move |conn| {
            conn.query_row(
                "SELECT public_key FROM vpn_peers WHERE uuid = ?1",
                [&uuid],
                |row| row.get::<_, String>(0)
            )
        }
    }).await;

    // Remove peer from WireGuard if found
    if let Ok(key) = public_key {
        if let Err(e) = WireGuardManager::remove_peer(&key) {
            eprintln!("Warning: Failed to remove WireGuard peer {}: {}", uuid, e);
            // Continue anyway to mark as revoked in database
        }
    }

    // Mark as revoked in database
    state.db.conn.call({
        let now = chrono::Utc::now().timestamp();
        move |conn| {
            conn.execute(
                "UPDATE vpn_peers SET revoked = 1, revoked_at = ?1 WHERE uuid = ?2",
                rusqlite::params![now, &uuid]
            )
        }
    }).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    Ok(StatusCode::NO_CONTENT)
}

pub fn vpn_routes(state: VpnState) -> Router {
    Router::new()
        .route("/api/vpn/register", post(register_peer))
        .route("/api/admin/vpn/peers", get(list_peers))
        .route("/api/admin/vpn/peers/:uuid", delete(revoke_peer))
        .with_state(state)
}
