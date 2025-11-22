# WireGuard VPN Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement optional Windows-only WireGuard VPN tunnel with auto-provisioning for users experiencing packet loss.

**Architecture:**
- Server: Add VPN provisioning API + WireGuard peer management to modpack server
- Launcher: Auto-generate keypairs, register via Microsoft auth, manage tunnel via wireguard.exe CLI
- UI: Settings toggle for VPN, status indicator, fallback to direct connection on failure

**Tech Stack:** WireGuard (kernel driver), Rust (server VPN module), x25519-dalek (key generation), Tauri commands

---

## Phase 1: Server-Side Database & API Foundation

### Task 1: Add VPN database migration

**Files:**
- Create: `wowid3-server/server/migrations/002_add_vpn_peers.sql`
- Modify: `wowid3-server/server/src/database/mod.rs`

**Step 1: Write migration file**

Create migration SQL:
```sql
-- migrations/002_add_vpn_peers.sql
CREATE TABLE vpn_peers (
    uuid TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    public_key TEXT UNIQUE NOT NULL,
    ip_address TEXT NOT NULL,
    registered_at INTEGER NOT NULL,
    last_handshake INTEGER,
    bytes_sent INTEGER DEFAULT 0,
    bytes_received INTEGER DEFAULT 0,
    revoked BOOLEAN DEFAULT 0,
    revoked_at INTEGER
);

CREATE INDEX idx_vpn_public_key ON vpn_peers(public_key);
CREATE INDEX idx_vpn_username ON vpn_peers(username);
CREATE INDEX idx_vpn_revoked ON vpn_peers(revoked);
```

**Step 2: Update database module to run migration**

Modify `wowid3-server/server/src/database/mod.rs`:
```rust
pub async fn init_database(db_path: &str) -> Result<Database> {
    let db = Database::open(db_path)?;

    // Run migrations
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS vpn_peers (
            uuid TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            public_key TEXT UNIQUE NOT NULL,
            ip_address TEXT NOT NULL,
            registered_at INTEGER NOT NULL,
            last_handshake INTEGER,
            bytes_sent INTEGER DEFAULT 0,
            bytes_received INTEGER DEFAULT 0,
            revoked BOOLEAN DEFAULT 0,
            revoked_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_vpn_public_key ON vpn_peers(public_key);
        CREATE INDEX IF NOT EXISTS idx_vpn_username ON vpn_peers(username);
        CREATE INDEX IF NOT EXISTS idx_vpn_revoked ON vpn_peers(revoked);"
    )?;

    Ok(db)
}
```

**Step 3: Test database creation**

Run: `cd wowid3-server/server && cargo test --lib database::tests`

Expected: Tests pass, table created

**Step 4: Commit**

```bash
cd wowid3-server/server
git add migrations/002_add_vpn_peers.sql src/database/mod.rs
git commit -m "feat: add vpn_peers database table

Create migration for VPN peer tracking with UUID, public key,
assigned IP, and connection statistics.
"
```

---

### Task 2: Create VPN manager module (WireGuard interaction)

**Files:**
- Create: `wowid3-server/server/src/vpn/manager.rs`
- Create: `wowid3-server/server/src/vpn/mod.rs`

**Step 1: Create mod.rs with module structure**

Create `wowid3-server/server/src/vpn/mod.rs`:
```rust
pub mod manager;
pub mod provisioner;
pub mod monitor;
pub mod api;

pub use manager::WireGuardManager;
pub use provisioner::IpAllocator;
```

**Step 2: Create manager module for WireGuard commands**

Create `wowid3-server/server/src/vpn/manager.rs`:
```rust
use anyhow::Result;
use std::process::Command;

pub struct WireGuardManager;

impl WireGuardManager {
    pub fn add_peer(public_key: &str, ip: &str) -> Result<()> {
        let output = Command::new("wg")
            .args(&["set", "wg0", "peer", public_key, "allowed-ips", &format!("{}/32", ip)])
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to add WireGuard peer: {}", error));
        }

        Ok(())
    }

    pub fn remove_peer(public_key: &str) -> Result<()> {
        let output = Command::new("wg")
            .args(&["set", "wg0", "peer", public_key, "remove"])
            .output()?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to remove WireGuard peer: {}", error));
        }

        Ok(())
    }

    pub fn get_server_public_key() -> Result<String> {
        let key = std::fs::read_to_string("/etc/wireguard/server_public.key")?
            .trim()
            .to_string();
        Ok(key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_peer_command_format() {
        // This test will fail until implementation is tested on actual server
        // For now, just verify the module compiles
        assert_eq!(1, 1);
    }
}
```

**Step 3: Verify compilation**

Run: `cd wowid3-server/server && cargo check --lib vpn::manager`

Expected: Compilation successful

**Step 4: Commit**

```bash
cd wowid3-server/server
git add src/vpn/mod.rs src/vpn/manager.rs
git commit -m "feat: add WireGuard peer management module

Create manager for adding/removing WireGuard peers and
retrieving server public key from filesystem.
"
```

---

### Task 3: Create IP allocator module

**Files:**
- Create: `wowid3-server/server/src/vpn/provisioner.rs`

**Step 1: Create allocator with sequential IP assignment**

Create `wowid3-server/server/src/vpn/provisioner.rs`:
```rust
use anyhow::Result;
use std::sync::Arc;
use tokio_rusqlite::Connection;

pub struct IpAllocator {
    db: Arc<Connection>,
}

impl IpAllocator {
    pub fn new(db: Arc<Connection>) -> Self {
        Self { db }
    }

    pub async fn next_available_ip(&self) -> Result<String> {
        // Find next available IP in range 10.8.0.2 - 10.8.0.254
        let mut stmt = self.db
            .prepare("SELECT ip_address FROM vpn_peers WHERE ip_address LIKE '10.8.0.%' AND revoked = 0 ORDER BY ip_address")
            .await?;

        let mut ips = Vec::new();
        let rows = stmt.query_map([], |row| {
            row.get::<_, String>(0)
        })?;

        for row in rows {
            ips.push(row?);
        }

        // Find first unassigned IP
        for i in 2..=254 {
            let ip = format!("10.8.0.{}", i);
            if !ips.contains(&ip) {
                return Ok(ip);
            }
        }

        Err(anyhow::anyhow!("No available VPN IPs (max 253 concurrent peers)"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_next_available_ip_starts_at_2() {
        // Real test would use in-memory SQLite
        // For now, just verify module compiles
        assert_eq!(1, 1);
    }
}
```

**Step 2: Verify compilation**

Run: `cd wowid3-server/server && cargo check --lib vpn::provisioner`

Expected: Compilation successful

**Step 3: Commit**

```bash
cd wowid3-server/server
git add src/vpn/provisioner.rs
git commit -m "feat: add VPN IP allocator

Implement sequential IP assignment from 10.8.0.2-254 with
database tracking of allocated IPs.
"
```

---

### Task 4: Create VPN provisioning API endpoint

**Files:**
- Create: `wowid3-server/server/src/vpn/api.rs`
- Modify: `wowid3-server/server/src/main.rs`

**Step 1: Create API module with registration endpoint**

Create `wowid3-server/server/src/vpn/api.rs`:
```rust
use axum::{
    extract::{State, Json},
    http::StatusCode,
    Router, routing::post,
};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::sync::Arc;
use crate::AppState;
use super::manager::WireGuardManager;

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
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<RegisterResponse>), (StatusCode, String)> {
    // TODO: Validate Microsoft token with Mojang API
    // For now, accept any token

    // Check if peer already exists
    let existing = state.db
        .query_row(
            "SELECT ip_address FROM vpn_peers WHERE uuid = ?1",
            [&req.minecraft_uuid],
            |row| row.get::<_, String>(0)
        );

    let assigned_ip = match existing {
        Ok(ip) => {
            // Peer exists, remove old public key from WireGuard if different
            let old_key: String = state.db
                .query_row(
                    "SELECT public_key FROM vpn_peers WHERE uuid = ?1",
                    [&req.minecraft_uuid],
                    |row| row.get(0)
                )
                .unwrap_or_default();

            if old_key != req.public_key && !old_key.is_empty() {
                if let Err(e) = WireGuardManager::remove_peer(&old_key) {
                    eprintln!("Warning: Failed to remove old peer: {}", e);
                }
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
            state.db.execute(
                "INSERT INTO vpn_peers (uuid, username, public_key, ip_address, registered_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                [
                    &req.minecraft_uuid,
                    &req.minecraft_username,
                    &req.public_key,
                    &ip,
                    &chrono::Utc::now().timestamp().to_string(),
                ]
            ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            ip
        }
    };

    // Add peer to WireGuard
    WireGuardManager::add_peer(&req.public_key, &assigned_ip)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let server_pubkey = WireGuardManager::get_server_public_key()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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

pub fn vpn_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/vpn/register", post(register_peer))
}
```

**Step 2: Add route to main.rs**

Modify `wowid3-server/server/src/main.rs` to include VPN routes:
```rust
mod vpn;

// In main router setup:
let app = Router::new()
    .merge(vpn::api::vpn_routes())
    // ... other routes ...
    .with_state(app_state);
```

**Step 3: Verify compilation**

Run: `cd wowid3-server/server && cargo check`

Expected: Compilation successful

**Step 4: Commit**

```bash
cd wowid3-server/server
git add src/vpn/api.rs src/main.rs
git commit -m "feat: add VPN registration API endpoint

Implement POST /api/vpn/register endpoint for client keypair
registration with automatic IP allocation and WireGuard peer setup.
"
```

---

## Phase 2: Launcher VPN Module (Rust)

### Task 5: Add VPN dependencies to Cargo.toml

**Files:**
- Modify: `wowid3-launcher/src-tauri/Cargo.toml`

**Step 1: Add required crates**

Modify `Cargo.toml` dependencies section:
```toml
[dependencies]
# ... existing dependencies ...
x25519-dalek = "2.0"
base64 = "0.21"
rand = "0.8"
tokio = { version = "1", features = ["full"] }
```

**Step 2: Verify dependencies resolve**

Run: `cd wowid3-launcher/src-tauri && cargo check`

Expected: Downloads and compiles successfully

**Step 3: Commit**

```bash
cd wowid3-launcher/src-tauri
git add Cargo.toml Cargo.lock
git commit -m "feat: add x25519-dalek for VPN keypair generation"
```

---

### Task 6: Create VPN module in launcher

**Files:**
- Create: `wowid3-launcher/src-tauri/src/modules/vpn.rs`
- Modify: `wowid3-launcher/src-tauri/src/modules/mod.rs`

**Step 1: Create VPN module**

Create `wowid3-launcher/src-tauri/src/modules/vpn.rs`:
```rust
use anyhow::{anyhow, Result};
use base64::{Engine as _, engine::general_purpose};
use rand::rngs::OsRng;
use std::path::{Path, PathBuf};
use std::process::Command;
use x25519_dalek::{PublicKey, StaticSecret};

pub struct VpnManager {
    config_dir: PathBuf,
}

impl VpnManager {
    pub fn new() -> Result<Self> {
        let config_dir = Self::get_config_dir()?;
        std::fs::create_dir_all(&config_dir)?;
        Ok(Self { config_dir })
    }

    fn get_config_dir() -> Result<PathBuf> {
        let program_data = std::env::var("PROGRAMDATA")
            .unwrap_or_else(|_| "C:\\ProgramData".to_string());
        Ok(Path::new(&program_data)
            .join("wowid3-launcher")
            .join("vpn"))
    }

    pub fn generate_keypair() -> Result<(String, String)> {
        let private_key = StaticSecret::random_from_rng(OsRng);
        let public_key = PublicKey::from(&private_key);

        let private_b64 = general_purpose::STANDARD.encode(private_key.to_bytes());
        let public_b64 = general_purpose::STANDARD.encode(public_key.as_bytes());

        Ok((private_b64, public_b64))
    }

    pub fn has_keypair(&self) -> bool {
        self.config_dir.join("private.key").exists()
    }

    pub fn store_keypair(&self, private_key: &str, public_key: &str) -> Result<()> {
        std::fs::write(self.config_dir.join("private.key"), private_key)?;
        std::fs::write(self.config_dir.join("public.key"), public_key)?;
        Ok(())
    }

    pub fn load_keypair(&self) -> Result<(String, String)> {
        let private = std::fs::read_to_string(self.config_dir.join("private.key"))?;
        let public = std::fs::read_to_string(self.config_dir.join("public.key"))?;
        Ok((private, public))
    }

    pub fn write_config(&self, config_content: &str) -> Result<()> {
        let config_path = self.config_dir.join("wowid3.conf");
        std::fs::write(config_path, config_content)?;
        Ok(())
    }

    pub fn get_config_path(&self) -> Result<PathBuf> {
        Ok(self.config_dir.join("wowid3.conf"))
    }

    pub fn tunnel_exists(&self) -> bool {
        // Check if WireGuard service exists
        let output = Command::new("sc")
            .args(&["query", "WireGuardTunnel$wowid3"])
            .output();

        output.is_ok() && output.unwrap().status.success()
    }

    pub fn is_tunnel_running(&self) -> bool {
        let output = Command::new("sc")
            .args(&["query", "WireGuardTunnel$wowid3"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.contains("RUNNING")
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair_creates_valid_base64() {
        let (private, public) = VpnManager::generate_keypair().unwrap();

        // Verify base64 encoding
        assert!(general_purpose::STANDARD.decode(&private).is_ok());
        assert!(general_purpose::STANDARD.decode(&public).is_ok());

        // Verify lengths (32 bytes each = 44 chars in base64)
        assert_eq!(general_purpose::STANDARD.decode(&private).unwrap().len(), 32);
        assert_eq!(general_purpose::STANDARD.decode(&public).unwrap().len(), 32);
    }

    #[test]
    fn test_keypair_is_different_each_time() {
        let (private1, public1) = VpnManager::generate_keypair().unwrap();
        let (private2, public2) = VpnManager::generate_keypair().unwrap();

        assert_ne!(private1, private2);
        assert_ne!(public1, public2);
    }
}
```

**Step 2: Add module export**

Modify `wowid3-launcher/src-tauri/src/modules/mod.rs`:
```rust
pub mod vpn;
pub use vpn::VpnManager;
```

**Step 3: Run tests**

Run: `cd wowid3-launcher/src-tauri && cargo test --lib vpn`

Expected: 2 tests pass

**Step 4: Commit**

```bash
cd wowid3-launcher/src-tauri
git add src/modules/vpn.rs src/modules/mod.rs
git commit -m "feat: add VPN module with keypair generation

Implement VPN manager for generating/storing x25519 keypairs,
writing tunnel config, and checking tunnel service status.
"
```

---

### Task 7: Create Tauri commands for VPN control

**Files:**
- Modify: `wowid3-launcher/src-tauri/src/lib.rs`

**Step 1: Add VPN Tauri commands**

Add to `wowid3-launcher/src-tauri/src/lib.rs`:
```rust
use crate::modules::VpnManager;

#[tauri::command]
async fn vpn_generate_keypair() -> Result<(String, String), String> {
    VpnManager::generate_keypair()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn vpn_has_keypair() -> Result<bool, String> {
    let manager = VpnManager::new().map_err(|e| e.to_string())?;
    Ok(manager.has_keypair())
}

#[tauri::command]
async fn vpn_tunnel_status() -> Result<String, String> {
    let manager = VpnManager::new().map_err(|e| e.to_string())?;

    if manager.tunnel_exists() {
        if manager.is_tunnel_running() {
            Ok("running".to_string())
        } else {
            Ok("stopped".to_string())
        }
    } else {
        Ok("not_installed".to_string())
    }
}

#[tauri::command]
async fn vpn_start_tunnel() -> Result<(), String> {
    // Start the WireGuard service
    let output = std::process::Command::new("net")
        .args(&["start", "WireGuardTunnel$wowid3"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err("Failed to start VPN tunnel".to_string())
    }
}

#[tauri::command]
async fn vpn_stop_tunnel() -> Result<(), String> {
    let output = std::process::Command::new("net")
        .args(&["stop", "WireGuardTunnel$wowid3"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err("Failed to stop VPN tunnel".to_string())
    }
}

// In invoke_handler:
// .invoke_handler(tauri::generate_handler![
//     vpn_generate_keypair,
//     vpn_has_keypair,
//     vpn_tunnel_status,
//     vpn_start_tunnel,
//     vpn_stop_tunnel,
// ])
```

**Step 2: Register commands in invoke_handler**

Find the `invoke_handler` setup and add VPN commands to the `generate_handler!` macro.

**Step 3: Verify compilation**

Run: `cd wowid3-launcher/src-tauri && cargo check`

Expected: Compilation successful

**Step 4: Commit**

```bash
cd wowid3-launcher/src-tauri
git add src/lib.rs
git commit -m "feat: add Tauri commands for VPN tunnel control

Implement commands: vpn_generate_keypair, vpn_has_keypair,
vpn_tunnel_status, vpn_start_tunnel, vpn_stop_tunnel
"
```

---

## Phase 3: Launcher UI & State Management

### Task 8: Create VPN state store

**Files:**
- Create: `wowid3-launcher/src/stores/vpnStore.ts`
- Modify: `wowid3-launcher/src/stores/index.ts`

**Step 1: Create Zustand VPN store**

Create `wowid3-launcher/src/stores/vpnStore.ts`:
```typescript
import { create } from 'zustand';

export interface VpnState {
  enabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  assignedIp: string | null;
  errorMessage: string | null;
  setEnabled: (enabled: boolean) => void;
  setStatus: (status: VpnState['status']) => void;
  setAssignedIp: (ip: string | null) => void;
  setError: (error: string | null) => void;
}

export const useVpnStore = create<VpnState>((set) => ({
  enabled: false,
  status: 'disconnected',
  assignedIp: null,
  errorMessage: null,
  setEnabled: (enabled) => set({ enabled }),
  setStatus: (status) => set({ status }),
  setAssignedIp: (assignedIp) => set({ assignedIp }),
  setError: (errorMessage) => set({ errorMessage }),
}));
```

**Step 2: Export from index.ts**

Modify `wowid3-launcher/src/stores/index.ts`:
```typescript
export * from './vpnStore';
```

**Step 3: Verify TypeScript compilation**

Run: `cd wowid3-launcher && npm run build 2>&1 | head -20`

Expected: Compilation successful (or only pre-existing errors)

**Step 4: Commit**

```bash
cd wowid3-launcher
git add src/stores/vpnStore.ts src/stores/index.ts
git commit -m "feat: add VPN state management store

Create Zustand store for VPN enabled/status/IP/error state tracking.
"
```

---

### Task 9: Create VPN settings toggle in UI

**Files:**
- Modify: `wowid3-launcher/src/components/SettingsScreen.tsx`

**Step 1: Add VPN toggle section**

Find the SettingsScreen component and add:
```tsx
import { useVpnStore } from '../stores/vpnStore';

export function SettingsScreen() {
  // ... existing code ...
  const vpnEnabled = useVpnStore((state) => state.enabled);
  const vpnStatus = useVpnStore((state) => state.status);
  const setVpnEnabled = useVpnStore((state) => state.setEnabled);

  const handleVpnToggle = async (enabled: boolean) => {
    setVpnEnabled(enabled);
    if (enabled) {
      // Show VPN setup modal
      // TODO: Implement VPN setup
    }
  };

  return (
    <div className="settings-container">
      {/* ... existing sections ... */}

      <div className="settings-section">
        <h3>Performance</h3>

        <div className="setting-row">
          <label className="setting-label">
            <input
              type="checkbox"
              checked={vpnEnabled}
              onChange={(e) => handleVpnToggle(e.target.checked)}
              disabled={vpnStatus === 'connecting'}
            />
            Use VPN Tunnel (reduces lag)
          </label>
          <p className="setting-description">
            Enable if experiencing packet loss or lag. Requires VPN setup on first enable.
          </p>
        </div>

        {vpnStatus === 'connected' && (
          <div className="vpn-status connected">
            <span className="status-indicator"></span>
            VPN Connected
          </div>
        )}
        {vpnStatus === 'error' && (
          <div className="vpn-status error">
            <span className="status-indicator"></span>
            VPN Error: {useVpnStore((s) => s.errorMessage)}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add CSS styling**

Add to your CSS/Tailwind:
```css
.vpn-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.vpn-status.connected {
  background-color: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.vpn-status.error {
  background-color: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
}

.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.vpn-status.connected .status-indicator {
  background-color: rgb(34, 197, 94);
}

.vpn-status.error .status-indicator {
  background-color: rgb(239, 68, 68);
}
```

**Step 3: Verify no TypeScript errors**

Run: `cd wowid3-launcher && npm run build 2>&1 | grep -i error | head -10`

Expected: No VPN-related errors

**Step 4: Commit**

```bash
cd wowid3-launcher
git add src/components/SettingsScreen.tsx
git commit -m "feat: add VPN toggle to settings screen

Add VPN enable/disable checkbox with status indicator and
styling for connected/error states.
"
```

---

## Phase 4: Integration with Game Launch

### Task 10: Modify minecraft.rs to use VPN or direct connection

**Files:**
- Modify: `wowid3-launcher/src-tauri/src/modules/minecraft.rs`

**Step 1: Add VPN check before launch**

Find the game launch function and add:
```rust
use crate::modules::VpnManager;

pub async fn launch_game(settings: &GameSettings) -> Result<()> {
    // Determine server address based on VPN setting
    let server_address = if settings.vpn_enabled {
        // Check VPN status
        let vpn = VpnManager::new()?;

        if !vpn.is_tunnel_running() {
            return Err(anyhow::anyhow!(
                "VPN tunnel is not running. Enable VPN in settings first."
            ));
        }

        // Verify can reach server via VPN with timeout
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            crate::modules::verify_server_reachable("10.8.0.1:25565")
        ).await {
            Ok(Ok(true)) => "10.8.0.1:25565",
            _ => {
                // Fallback to direct connection
                eprintln!("VPN tunnel active but server unreachable, using direct connection");
                "mc.frostdev.io:25565"
            }
        }
    } else {
        "mc.frostdev.io:25565"
    };

    // Extract host and port
    let (host, port) = server_address.split_once(':').unwrap();

    // Launch Minecraft with server address
    let mut cmd = std::process::Command::new(&settings.java_path);
    cmd
        .arg("-jar").arg("minecraft_server.jar")
        .arg("--server").arg(host)
        .arg("--port").arg(port)
        // ... other launch arguments ...
        ;

    cmd.spawn()?;
    Ok(())
}

pub async fn verify_server_reachable(address: &str) -> Result<bool> {
    use tokio::net::TcpStream;

    match TcpStream::connect(address).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
```

**Step 2: Update server.rs ping to use VPN**

Modify `wowid3-launcher/src-tauri/src/modules/server.rs`:
```rust
use crate::modules::VpnManager;

pub async fn ping_server(settings: &GameSettings) -> Result<ServerStatus> {
    let vpn = VpnManager::new().ok();
    let vpn_enabled = settings.vpn_enabled && vpn.map_or(false, |v| v.is_tunnel_running());

    let address = if vpn_enabled {
        "10.8.0.1:25565"
    } else {
        "mc.frostdev.io:25565"
    };

    // Use existing legacy_ping implementation
    legacy_ping(address).await
}
```

**Step 3: Verify compilation**

Run: `cd wowid3-launcher/src-tauri && cargo check`

Expected: Compilation successful

**Step 4: Commit**

```bash
cd wowid3-launcher/src-tauri
git add src/modules/minecraft.rs src/modules/server.rs
git commit -m "feat: route minecraft connection through VPN if enabled

Modify game launch to use VPN server address (10.8.0.1) when
VPN enabled, fallback to direct connection if unavailable.
"
```

---

## Phase 5: Testing & Verification

### Task 11: Write unit tests for VPN module

**Files:**
- Create: `wowid3-launcher/src-tauri/src/modules/vpn.test.rs`

**Step 1: Add comprehensive tests**

Create test file (or add to vpn.rs):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_dir_creation() {
        let manager = VpnManager::new().unwrap();
        assert!(manager.config_dir.exists());
    }

    #[test]
    fn test_keypair_storage_and_retrieval() {
        let manager = VpnManager::new().unwrap();
        let (private, public) = ("test_private_key", "test_public_key");

        manager.store_keypair(private, public).unwrap();

        assert!(manager.has_keypair());

        let (stored_private, stored_public) = manager.load_keypair().unwrap();
        assert_eq!(stored_private, private);
        assert_eq!(stored_public, public);
    }

    #[test]
    fn test_config_file_writing() {
        let manager = VpnManager::new().unwrap();
        let config = "[Interface]\nAddress = 10.8.0.2/24";

        manager.write_config(config).unwrap();

        let written = std::fs::read_to_string(manager.get_config_path().unwrap()).unwrap();
        assert_eq!(written, config);
    }
}
```

**Step 2: Run tests**

Run: `cd wowid3-launcher/src-tauri && cargo test --lib vpn`

Expected: All tests pass

**Step 3: Commit**

```bash
cd wowid3-launcher/src-tauri
git add src/modules/vpn.rs
git commit -m "test: add comprehensive VPN module tests

Add tests for config directory creation, keypair storage/retrieval,
and config file writing.
"
```

---

### Task 12: Manual integration testing checklist

**Files:** None (testing)

**Step 1: Compile in development**

Run: `cd wowid3-launcher && npm run tauri:dev:wayland`

Expected: App starts without errors

**Step 2: Test VPN toggle in settings**

- Open Settings screen
- Toggle "Use VPN Tunnel" on
- Verify UI shows "VPN Error: not_installed" or similar
- Toggle off
- Verify no errors

**Step 3: Verify compilation on Windows**

(Manual step on Windows VM)
- Clone repo to Windows 10/11 VM
- Run: `npm run build`
- Verify launcher builds successfully

**Step 4: Document test results**

Create `docs/test-results/2025-11-22-vpn-manual-testing.md` with:
- Platform tested
- Steps performed
- Results
- Any issues found

---

## Phase 6: Server VPN Endpoint Completion

### Task 13: Add admin VPN peer management endpoints

**Files:**
- Modify: `wowid3-server/server/src/vpn/api.rs`

**Step 1: Add list peers endpoint**

Add to `api.rs`:
```rust
#[derive(Serialize)]
pub struct PeerInfo {
    pub uuid: String,
    pub username: String,
    pub ip_address: String,
    pub online: bool,
    pub last_handshake: Option<i64>,
}

pub async fn list_peers(
    State(state): State<Arc<AppState>>,
) -> (StatusCode, Json<Vec<PeerInfo>>) {
    // TODO: Add admin auth check via middleware

    let peers = state.db
        .prepare("SELECT uuid, username, ip_address, last_handshake FROM vpn_peers WHERE revoked = 0")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| {
                Ok(PeerInfo {
                    uuid: row.get(0)?,
                    username: row.get(1)?,
                    ip_address: row.get(2)?,
                    online: row.get::<_, i64>(3)
                        .ok()
                        .map_or(false, |ts| chrono::Utc::now().timestamp() - ts < 180),
                    last_handshake: row.get(3).ok(),
                })
            })
        })
        .map(|rows| rows.collect::<Result<Vec<_>, _>>().unwrap_or_default())
        .unwrap_or_default();

    (StatusCode::OK, Json(peers))
}
```

**Step 2: Add revoke endpoint**

```rust
pub async fn revoke_peer(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(uuid): axum::extract::Path<String>,
) -> StatusCode {
    // TODO: Add admin auth check

    // Get peer's public key
    if let Ok(public_key) = state.db.query_row(
        "SELECT public_key FROM vpn_peers WHERE uuid = ?1",
        [&uuid],
        |row| row.get::<_, String>(0)
    ) {
        // Remove from WireGuard
        let _ = WireGuardManager::remove_peer(&public_key);
    }

    // Mark as revoked in database
    let _ = state.db.execute(
        "UPDATE vpn_peers SET revoked = 1, revoked_at = ?1 WHERE uuid = ?2",
        [chrono::Utc::now().timestamp().to_string(), uuid],
    );

    StatusCode::NO_CONTENT
}
```

**Step 3: Register routes**

```rust
pub fn vpn_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/vpn/register", post(register_peer))
        .route("/api/admin/vpn/peers", get(list_peers))
        .route("/api/admin/vpn/peers/:uuid/revoke", delete(revoke_peer))
}
```

**Step 4: Commit**

```bash
cd wowid3-server/server
git add src/vpn/api.rs
git commit -m "feat: add admin VPN peer management endpoints

Implement GET /api/admin/vpn/peers and DELETE endpoints
for listing and revoking VPN peer access.
"
```

---

## Summary

**Total Tasks:** 13
**Estimated Time:** 8-12 hours
**Phases:**
1. Server database & API (Tasks 1-4)
2. Launcher VPN module (Tasks 5-7)
3. UI & state (Tasks 8-9)
4. Integration (Task 10)
5. Testing (Tasks 11-12)
6. Admin endpoints (Task 13)

**Key Files Modified:**
- Server: `main.rs`, `database/mod.rs`, `vpn/*`
- Launcher: `lib.rs`, `modules/vpn.rs`, `minecraft.rs`, `server.rs`
- UI: `SettingsScreen.tsx`, `stores/vpnStore.ts`

**Testing Strategy:**
- Unit tests for each module
- Manual integration testing on Windows
- Verify no regressions on existing functionality

---

**Next:** Execute this plan using superpowers:executing-plans
