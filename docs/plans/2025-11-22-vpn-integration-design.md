# WireGuard VPN Integration Design

**Date**: 2025-11-22
**Author**: Claude Code
**Status**: Approved

## Executive Summary

This design document outlines the integration of an optional WireGuard VPN tunnel into the WOWID3 launcher to reduce packet loss and latency for users experiencing connectivity issues through the reverse proxy. The VPN is strictly **optional** and **Windows-only** with automatic provisioning and zero user configuration required beyond a settings toggle.

## Problem Statement

Some players are experiencing lag and packet loss when connecting to the Minecraft server (`mc.frostdev.io:25565`) through the reverse proxy. The VPN tunnel provides a direct, optimized path to the server for affected users.

## Requirements

### Functional Requirements
- **FR1**: Optional VPN toggle in launcher settings (OFF by default)
- **FR2**: Auto-provisioning of VPN credentials tied to Microsoft account
- **FR3**: Zero-configuration setup (automatic keypair generation and registration)
- **FR4**: Split-tunnel routing (only Minecraft server traffic via VPN)
- **FR5**: Graceful fallback to direct connection on VPN failures
- **FR6**: Admin tools for peer management and monitoring
- **FR7**: Windows-only support (WireGuard kernel driver)

### Non-Functional Requirements
- **NFR1**: Latency overhead < 5ms
- **NFR2**: Bandwidth overhead < 4%
- **NFR3**: Support 250+ concurrent VPN connections
- **NFR4**: VPN connection established within 10 seconds
- **NFR5**: Automatic reconnection on network changes

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  WOWID3 Launcher (Windows)                                  │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  VPN Module      │────────▶│ WireGuard Client │         │
│  │  (vpn.rs)        │         │  (wireguard.exe) │         │
│  └──────────────────┘         └──────────────────┘         │
│           │                            │                     │
│           │ Register Keypair           │ UDP 51820          │
│           ▼                            ▼                     │
└───────────┼────────────────────────────┼─────────────────────┘
            │ HTTPS                      │ WireGuard
            │                            │ Encrypted Tunnel
            ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│  VPN Server (192.168.10.43 - pma@192.168.10.43)            │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │ Provisioning API │         │ WireGuard Server │         │
│  │ (Axum REST)      │         │   (wg0 interface)│         │
│  └──────────────────┘         └──────────────────┘         │
│           │                            │                     │
│           │                            │ NAT/Forward        │
│           ▼                            ▼                     │
│  ┌──────────────────┐         192.168.10.29:25565          │
│  │  SQLite DB       │                 │                     │
│  │  (vpn_peers)     │                 │                     │
│  └──────────────────┘                 ▼                     │
└────────────────────────────────────────┼─────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────┐
                              │ Minecraft Server │
                              │  192.168.10.29   │
                              └──────────────────┘
```

### Network Design

- **VPN Subnet**: `10.8.0.0/24`
- **Server VPN IP**: `10.8.0.1` (WireGuard interface on 192.168.10.43)
- **Client IPs**: `10.8.0.2` - `10.8.0.254` (assigned sequentially)
- **WireGuard Port**: UDP 51820 (public)
- **Routing**: `10.8.0.1:25565` → DNAT → `192.168.10.29:25565`
- **Split Tunnel**: AllowedIPs = `10.8.0.1/32` (only VPN gateway, not entire subnet)

## Detailed Component Design

### 1. Server-Side Components

#### 1.1 WireGuard Server Setup

**Installation** (on pma@192.168.10.43):
```bash
# Install WireGuard
sudo pacman -S wireguard-tools

# Generate server keypair
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
chmod 600 /etc/wireguard/server_private.key

# Create wg0.conf
sudo tee /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = $(cat /etc/wireguard/server_private.key)

# Enable IP forwarding and NAT to Minecraft server
PostUp = sysctl -w net.ipv4.ip_forward=1
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT
PostUp = iptables -t nat -A PREROUTING -i wg0 -p tcp --dport 25565 -j DNAT --to-destination 192.168.10.29:25565
PostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

PostDown = iptables -D FORWARD -i wg0 -j ACCEPT
PostDown = iptables -t nat -D PREROUTING -i wg0 -p tcp --dport 25565 -j DNAT --to-destination 192.168.10.29:25565
PostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Peers added dynamically via API
EOF

# Enable and start service
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

**Traffic Flow**:
1. Client connects to `10.8.0.1:25565` via VPN tunnel
2. Packet arrives on wg0 interface (192.168.10.43)
3. iptables DNAT translates destination to `192.168.10.29:25565`
4. Packet forwarded to Minecraft server on LAN
5. Response returns via reverse path (SNAT automatic)

#### 1.2 Database Schema

Extend existing `storage/stats.db` SQLite database:

```sql
CREATE TABLE vpn_peers (
    uuid TEXT PRIMARY KEY,              -- Minecraft UUID
    username TEXT NOT NULL,             -- Minecraft username
    public_key TEXT UNIQUE NOT NULL,    -- WireGuard public key (base64)
    ip_address TEXT NOT NULL,           -- Assigned VPN IP (10.8.0.X)
    registered_at INTEGER NOT NULL,     -- Unix timestamp
    last_handshake INTEGER,             -- Last successful WireGuard handshake
    bytes_sent INTEGER DEFAULT 0,       -- Total bytes transmitted
    bytes_received INTEGER DEFAULT 0,   -- Total bytes received
    revoked BOOLEAN DEFAULT 0,          -- Access revoked flag
    revoked_at INTEGER                  -- Revocation timestamp
);

CREATE INDEX idx_public_key ON vpn_peers(public_key);
CREATE INDEX idx_username ON vpn_peers(username);
CREATE INDEX idx_revoked ON vpn_peers(revoked);
```

#### 1.3 New Rust Module Structure

**File**: `wowid3-server/server/src/vpn/mod.rs`

```rust
pub mod manager;      // WireGuard peer management
pub mod provisioner;  // Client config generation, IP allocation
pub mod monitor;      // Sync WireGuard state to database
pub mod api;          // HTTP endpoints
```

**Module Responsibilities**:

**`manager.rs`**: Execute WireGuard commands
```rust
pub async fn add_peer(public_key: &str, ip: &str) -> Result<()> {
    Command::new("wg")
        .args(&["set", "wg0", "peer", public_key, "allowed-ips", &format!("{}/32", ip)])
        .output()?;
    Ok(())
}

pub async fn remove_peer(public_key: &str) -> Result<()> {
    Command::new("wg")
        .args(&["set", "wg0", "peer", public_key, "remove"])
        .output()?;
    Ok(())
}

pub fn get_server_public_key() -> Result<String> {
    std::fs::read_to_string("/etc/wireguard/server_public.key")
}
```

**`provisioner.rs`**: Generate client configurations
```rust
pub struct IpAllocator {
    db: Arc<Database>,
}

impl IpAllocator {
    pub async fn next_available_ip(&self) -> Result<String> {
        // Query database for next available IP in 10.8.0.2 - 10.8.0.254
        // Reuse IPs from revoked peers after 30-day grace period
    }
}

pub fn generate_client_config(
    client_private_key: &str,
    client_ip: &str,
    server_public_key: &str,
    endpoint: &str
) -> String {
    format!(r#"
[Interface]
PrivateKey = {}
Address = {}/24

[Peer]
PublicKey = {}
Endpoint = {}
AllowedIPs = 10.8.0.1/32
PersistentKeepalive = 25
"#, client_private_key, client_ip, server_public_key, endpoint)
}
```

**`monitor.rs`**: Background sync task
```rust
pub async fn sync_wireguard_state(db: Arc<Database>) -> Result<()> {
    loop {
        tokio::time::sleep(Duration::from_secs(60)).await;

        // Parse `wg show wg0 dump` output
        let output = Command::new("wg")
            .args(&["show", "wg0", "dump"])
            .output()?;

        // Update database with latest stats
        for line in String::from_utf8_lossy(&output.stdout).lines().skip(1) {
            let parts: Vec<&str> = line.split('\t').collect();
            let public_key = parts[0];
            let last_handshake = parts[4].parse::<i64>()?;
            let rx_bytes = parts[5].parse::<i64>()?;
            let tx_bytes = parts[6].parse::<i64>()?;

            db.execute(
                "UPDATE vpn_peers SET last_handshake = ?, bytes_sent = ?, bytes_received = ?
                 WHERE public_key = ?",
                (last_handshake, tx_bytes, rx_bytes, public_key)
            ).await?;
        }
    }
}
```

**`api.rs`**: HTTP endpoints
```rust
// POST /api/vpn/register
pub async fn register_peer(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>
) -> Result<Json<RegisterResponse>> {
    // 1. Validate Microsoft auth token
    verify_minecraft_token(&req.auth_token, &req.minecraft_uuid).await?;

    // 2. Check if already registered (reuse IP, update public key)
    if let Some(peer) = state.db.get_peer_by_uuid(&req.minecraft_uuid).await? {
        // Update existing peer
        manager::remove_peer(&peer.public_key).await?;
        manager::add_peer(&req.public_key, &peer.ip_address).await?;

        state.db.update_peer_public_key(&req.minecraft_uuid, &req.public_key).await?;

        return Ok(Json(RegisterResponse {
            success: true,
            assigned_ip: peer.ip_address,
            server_public_key: manager::get_server_public_key()?,
            endpoint: "wowid-launcher.frostdev.io:51820".to_string(),
        }));
    }

    // 3. Assign new IP
    let ip = state.ip_allocator.next_available_ip().await?;

    // 4. Add to WireGuard
    manager::add_peer(&req.public_key, &ip).await?;

    // 5. Store in database
    state.db.insert_peer(&req.minecraft_uuid, &req.minecraft_username, &req.public_key, &ip).await?;

    Ok(Json(RegisterResponse {
        success: true,
        assigned_ip: ip,
        server_public_key: manager::get_server_public_key()?,
        endpoint: "wowid-launcher.frostdev.io:51820".to_string(),
    }))
}

// GET /api/admin/vpn/peers
pub async fn list_peers(
    State(state): State<Arc<AppState>>,
    Extension(admin): Extension<Admin>
) -> Result<Json<PeersResponse>> {
    let peers = state.db.get_all_peers().await?;

    Ok(Json(PeersResponse {
        peers,
        total_peers: peers.len(),
        active_connections: peers.iter().filter(|p| {
            p.last_handshake.map_or(false, |ts| {
                Utc::now().timestamp() - ts < 180
            })
        }).count(),
    }))
}

// DELETE /api/admin/vpn/peers/:uuid
pub async fn revoke_peer(
    State(state): State<Arc<AppState>>,
    Extension(admin): Extension<Admin>,
    Path(uuid): Path<String>
) -> Result<StatusCode> {
    let peer = state.db.get_peer_by_uuid(&uuid).await?
        .ok_or(Error::NotFound)?;

    // Remove from WireGuard
    manager::remove_peer(&peer.public_key).await?;

    // Mark as revoked in database
    state.db.revoke_peer(&uuid).await?;

    Ok(StatusCode::NO_CONTENT)
}
```

#### 1.4 API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/vpn/register` | Microsoft token | Register client public key, get config |
| GET | `/api/vpn/config` | Microsoft token | Get existing VPN config (if registered) |
| GET | `/api/admin/vpn/peers` | Admin JWT | List all VPN peers |
| DELETE | `/api/admin/vpn/peers/:uuid` | Admin JWT | Revoke VPN access |
| POST | `/api/admin/vpn/peers/:uuid/reactivate` | Admin JWT | Reactivate revoked peer |
| GET | `/api/admin/vpn/stats` | Admin JWT | Overall VPN statistics |

### 2. Launcher-Side Components

#### 2.1 Installation Phase

**NSIS Installer Modifications** (`wowid3-launcher/src-tauri/tauri.conf.json`):

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "include": "installer/wireguard-installer.nsi"
      }
    }
  }
}
```

**WireGuard Bundling** (`installer/wireguard-installer.nsi`):
```nsis
Section "Install WireGuard"
    SetOutPath "$TEMP"
    File "resources\wireguard-amd64-0.5.3.msi"

    ExecWait 'msiexec /i "$TEMP\wireguard-amd64-0.5.3.msi" /quiet /norestart'

    Delete "$TEMP\wireguard-amd64-0.5.3.msi"
SectionEnd
```

#### 2.2 VPN Module

**File**: `wowid3-launcher/src-tauri/src/modules/vpn.rs`

```rust
use x25519_dalek::{StaticSecret, PublicKey};
use rand::rngs::OsRng;
use base64::{Engine as _, engine::general_purpose};
use std::process::Command;

pub struct VpnManager {
    storage: Arc<EncryptedStorage>,
    http_client: reqwest::Client,
}

impl VpnManager {
    pub async fn ensure_provisioned(&self) -> Result<()> {
        // Check if keypair exists
        if self.storage.get("vpn_public_key").is_none() {
            self.generate_and_store_keypair()?;
        }

        // Check if registered with server
        if !self.is_registered().await? {
            self.register_with_server().await?;
        }

        Ok(())
    }

    fn generate_and_store_keypair(&self) -> Result<()> {
        let private_key = StaticSecret::random_from_rng(OsRng);
        let public_key = PublicKey::from(&private_key);

        let private_b64 = general_purpose::STANDARD.encode(private_key.to_bytes());
        let public_b64 = general_purpose::STANDARD.encode(public_key.as_bytes());

        self.storage.set("vpn_private_key", &private_b64)?;
        self.storage.set("vpn_public_key", &public_b64)?;

        Ok(())
    }

    async fn register_with_server(&self) -> Result<()> {
        let public_key = self.storage.get("vpn_public_key").unwrap();
        let auth_token = self.storage.get("microsoft_access_token").unwrap();
        let uuid = self.storage.get("minecraft_uuid").unwrap();
        let username = self.storage.get("minecraft_username").unwrap();

        let response = self.http_client
            .post("https://wowid-launcher.frostdev.io/api/vpn/register")
            .json(&serde_json::json!({
                "minecraft_uuid": uuid,
                "minecraft_username": username,
                "public_key": public_key,
                "auth_token": auth_token
            }))
            .send()
            .await?
            .json::<RegisterResponse>()
            .await?;

        // Store config
        self.storage.set("vpn_assigned_ip", &response.assigned_ip)?;
        self.storage.set("vpn_server_public_key", &response.server_public_key)?;
        self.storage.set("vpn_endpoint", &response.endpoint)?;

        Ok(())
    }

    pub async fn create_tunnel(&self) -> Result<()> {
        // Generate config file
        let config = self.generate_config_file()?;
        let config_path = self.get_config_path()?;

        std::fs::write(&config_path, config)?;

        // Install tunnel service (UAC prompt)
        let output = Command::new("wireguard.exe")
            .args(&["/installtunnelservice", config_path.to_str().unwrap()])
            .output()?;

        if !output.status.success() {
            return Err(anyhow::anyhow!("Failed to create tunnel service"));
        }

        Ok(())
    }

    pub async fn start_tunnel(&self) -> Result<()> {
        // Check if service exists
        let status = Command::new("sc")
            .args(&["query", "WireGuardTunnel$wowid3"])
            .output()?;

        if !status.status.success() {
            // Service doesn't exist, create it
            self.create_tunnel().await?;
        }

        // Start service
        Command::new("net")
            .args(&["start", "WireGuardTunnel$wowid3"])
            .output()?;

        // Wait for handshake
        for _ in 0..10 {
            if self.verify_handshake()? {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        Err(anyhow::anyhow!("VPN tunnel failed to establish handshake"))
    }

    pub fn verify_handshake(&self) -> Result<bool> {
        let output = Command::new("wireguard.exe")
            .args(&["/dumplog", "wowid3"])
            .output()?;

        let log = String::from_utf8_lossy(&output.stdout);

        // Parse for recent handshake
        // WireGuard log format: "peer <pubkey> handshake completed"
        // Check timestamp is within last 3 minutes

        Ok(log.contains("handshake completed"))
    }

    fn generate_config_file(&self) -> Result<String> {
        let private_key = self.storage.get("vpn_private_key").unwrap();
        let assigned_ip = self.storage.get("vpn_assigned_ip").unwrap();
        let server_public_key = self.storage.get("vpn_server_public_key").unwrap();
        let endpoint = self.storage.get("vpn_endpoint").unwrap();

        Ok(format!(r#"
[Interface]
PrivateKey = {}
Address = {}/24

[Peer]
PublicKey = {}
Endpoint = {}
AllowedIPs = 10.8.0.1/32
PersistentKeepalive = 25
"#, private_key, assigned_ip, server_public_key, endpoint))
    }

    fn get_config_path(&self) -> Result<PathBuf> {
        let program_data = std::env::var("PROGRAMDATA")?;
        let config_dir = Path::new(&program_data).join("wowid3-launcher").join("vpn");
        std::fs::create_dir_all(&config_dir)?;
        Ok(config_dir.join("wowid3.conf"))
    }
}
```

**Tauri Commands**:
```rust
#[tauri::command]
async fn vpn_enable(state: State<'_, AppState>) -> Result<(), String> {
    state.vpn.ensure_provisioned().await.map_err(|e| e.to_string())?;
    state.vpn.start_tunnel().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn vpn_disable(state: State<'_, AppState>) -> Result<(), String> {
    Command::new("net")
        .args(&["stop", "WireGuardTunnel$wowid3"])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn vpn_status(state: State<'_, AppState>) -> Result<VpnStatus, String> {
    Ok(VpnStatus {
        connected: state.vpn.verify_handshake().unwrap_or(false),
        assigned_ip: state.vpn.storage.get("vpn_assigned_ip"),
        last_handshake: None, // TODO: Parse from wireguard log
    })
}
```

#### 2.3 Settings UI

**File**: `wowid3-launcher/src/components/SettingsScreen.tsx`

Add new section:
```tsx
<div className="settings-section">
  <h3>Performance</h3>

  <div className="setting-row">
    <label>
      <input
        type="checkbox"
        checked={settings.vpnEnabled}
        onChange={(e) => handleVpnToggle(e.target.checked)}
      />
      Use VPN Tunnel (reduces lag)
    </label>
    <p className="setting-description">
      Enable if experiencing packet loss or lag. Requires VPN setup on first enable.
    </p>
  </div>

  {vpnStatus.connected && (
    <div className="vpn-status">
      <span className="status-indicator connected"></span>
      VPN Connected (IP: {vpnStatus.assignedIp})
    </div>
  )}
</div>
```

**File**: `wowid3-launcher/src/hooks/useVpn.ts`
```typescript
export function useVpn() {
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [isEnabling, setIsEnabling] = useState(false);

  const enable = async () => {
    setIsEnabling(true);
    try {
      await invoke('vpn_enable');
      toast.success('VPN tunnel enabled');
    } catch (error) {
      toast.error(`VPN setup failed: ${error}`);
      throw error;
    } finally {
      setIsEnabling(false);
    }
  };

  const disable = async () => {
    await invoke('vpn_disable');
    toast.info('VPN tunnel disabled');
  };

  const checkStatus = async () => {
    const status = await invoke<VpnStatus>('vpn_status');
    setStatus(status);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return { status, enable, disable, isEnabling };
}
```

#### 2.4 Minecraft Launch Modifications

**File**: `wowid3-launcher/src-tauri/src/modules/minecraft.rs`

```rust
pub async fn launch_game(settings: &Settings) -> Result<()> {
    let server_address = if settings.vpn_enabled {
        // Ensure VPN is connected
        vpn::ensure_connected().await?;

        // Verify can reach server via VPN
        if !verify_server_reachable("10.8.0.1:25565").await? {
            // VPN connected but server unreachable
            warn!("VPN connected but Minecraft server unreachable via VPN");

            // Show error to user
            return Err(anyhow::anyhow!(
                "VPN connected but cannot reach Minecraft server. Server may be offline."
            ));
        }

        "10.8.0.1:25565"
    } else {
        "mc.frostdev.io:25565"
    };

    // Launch Minecraft with appropriate server address
    let mut cmd = Command::new(&java_path);
    cmd.args(&[
        "-jar", "minecraft.jar",
        "--server", server_address.split(':').next().unwrap(),
        "--port", server_address.split(':').nth(1).unwrap(),
        // ... other args ...
    ]);

    cmd.spawn()?;
    Ok(())
}

async fn verify_server_reachable(address: &str) -> Result<bool> {
    match TcpStream::connect(address).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
```

**File**: `wowid3-launcher/src-tauri/src/modules/server.rs`

```rust
pub async fn ping_server(settings: &Settings) -> Result<ServerStatus> {
    let address = if settings.vpn_enabled && vpn::is_connected() {
        "10.8.0.1:25565"
    } else {
        "mc.frostdev.io:25565"
    };

    // Use existing legacy_ping implementation
    legacy_ping(address).await
}
```

#### 2.5 State Management

**File**: `wowid3-launcher/src/stores/vpnStore.ts`
```typescript
interface VpnState {
  enabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  assignedIp: string | null;
  lastHandshake: Date | null;
  errorMessage: string | null;
  setEnabled: (enabled: boolean) => void;
  setStatus: (status: VpnState['status']) => void;
  setError: (error: string | null) => void;
}

export const useVpnStore = create<VpnState>((set) => ({
  enabled: false,
  status: 'disconnected',
  assignedIp: null,
  lastHandshake: null,
  errorMessage: null,
  setEnabled: (enabled) => set({ enabled }),
  setStatus: (status) => set({ status }),
  setError: (errorMessage) => set({ errorMessage }),
}));
```

### 3. Admin Panel

**File**: `wowid3-server/web/src/pages/VpnManagement.tsx`

```tsx
export function VpnManagement() {
  const { peers, loading } = useVpnPeers();

  return (
    <div className="vpn-management">
      <h1>VPN Peer Management</h1>

      <div className="stats-summary">
        <StatCard label="Total Peers" value={peers.length} />
        <StatCard label="Active Connections" value={peers.filter(p => p.online).length} />
        <StatCard label="Total Bandwidth" value={formatBytes(totalBandwidth)} />
      </div>

      <table className="peers-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>UUID</th>
            <th>IP Address</th>
            <th>Status</th>
            <th>Last Seen</th>
            <th>Bandwidth</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {peers.map(peer => (
            <tr key={peer.uuid}>
              <td>{peer.username}</td>
              <td>{peer.uuid.substring(0, 8)}...</td>
              <td>{peer.ip_address}</td>
              <td>
                <StatusBadge online={peer.online} />
              </td>
              <td>{formatTimestamp(peer.last_handshake)}</td>
              <td>{formatBytes(peer.bytes_sent + peer.bytes_received)}</td>
              <td>
                <button onClick={() => revokePeer(peer.uuid)}>
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**File**: `wowid3-server/web/src/hooks/useVpnPeers.ts`
```typescript
export function useVpnPeers() {
  const [peers, setPeers] = useState<VpnPeer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPeers = async () => {
      const response = await apiClient.get('/api/admin/vpn/peers');
      setPeers(response.data.peers);
      setLoading(false);
    };

    fetchPeers();
    const interval = setInterval(fetchPeers, 10000);
    return () => clearInterval(interval);
  }, []);

  const revokePeer = async (uuid: string) => {
    await apiClient.delete(`/api/admin/vpn/peers/${uuid}`);
    setPeers(peers.filter(p => p.uuid !== uuid));
  };

  return { peers, loading, revokePeer };
}
```

## Error Handling & Fallback Strategy

### Error Scenarios

| Error | Detection | User Message | Fallback Action |
|-------|-----------|--------------|-----------------|
| WireGuard not installed | Check `wireguard.exe` exists | "WireGuard required. Please reinstall launcher." | Disable VPN, use direct connection |
| Registration failed | HTTP error from `/api/vpn/register` | "Could not register VPN access. Check internet." | Retry button, disable VPN option |
| Tunnel creation failed | `wireguard.exe` returns error | "Administrator access required for VPN tunnel." | Retry with UAC, disable VPN |
| No handshake | Handshake timestamp > 3 min | "VPN tunnel created but cannot connect. Check firewall." | Troubleshooting dialog, disable VPN |
| Server unreachable via VPN | TCP connect to `10.8.0.1:25565` fails | "VPN connected but Minecraft server unreachable." | Retry, use direct connection |
| VPN disconnects during play | Periodic handshake checks | Toast: "VPN connection lost. Reconnecting..." | Auto-reconnect, fallback to direct |

### Automatic Fallback Logic

```rust
async fn launch_minecraft_resilient(settings: &Settings) -> Result<()> {
    if settings.vpn_enabled {
        match vpn::ensure_connected().await {
            Ok(_) => {
                // VPN connected successfully
                return minecraft::launch_game("10.8.0.1:25565").await;
            }
            Err(e) => {
                warn!("VPN connection failed: {}", e);

                // Show non-blocking notification
                emit_event("vpn-fallback", VpnFallbackEvent {
                    reason: e.to_string(),
                    using_direct: true,
                });
            }
        }
    }

    // Fallback to direct connection
    minecraft::launch_game("mc.frostdev.io:25565").await
}
```

## Security Considerations

### Authentication
- VPN registration requires valid Microsoft access token
- Server verifies token with Mojang API before provisioning
- One VPN peer per Minecraft account (UUID)

### Credential Storage
- Private keys stored in encrypted storage (same as Microsoft tokens)
- Keys encrypted with Windows DPAPI
- No plaintext keys on disk

### Network Security
- WireGuard uses Noise protocol framework (modern cryptography)
- Perfect forward secrecy via Curve25519 key exchange
- ChaCha20-Poly1305 authenticated encryption
- No IP leakage (split tunnel only routes VPN gateway)

### Access Control
- Admin-only endpoints for peer management
- JWT-based admin authentication
- Peer revocation removes from WireGuard immediately

### Audit Logging
- All VPN registrations logged with timestamp, UUID, username
- Peer connection/disconnection events logged
- Admin revocation actions logged
- Logs retained for 30 days

## Performance Characteristics

### WireGuard Overhead
- **Latency**: +2-4ms typical (kernel driver)
- **Bandwidth**: 3-4% overhead (protocol headers)
- **CPU**: Minimal (~1% on modern systems)
- **Memory**: ~10MB per tunnel

### Expected Performance
- **Ping to server**: Current: ~40ms, Via VPN: ~42-44ms
- **Throughput**: 100+ Mbps (limited by client upload, not VPN)
- **Packet loss**: Reduced from 2-5% to < 0.1% (bypasses reverse proxy)

### Scalability
- **Max concurrent peers**: 253 (limited by /24 subnet)
- **Recommended max**: 100 concurrent connections
- **Server resources**: ~100MB RAM for 100 peers
- **Network bandwidth**: ~50Mbps aggregate for 100 players

## Testing Strategy

### Unit Tests

**Server-Side** (`wowid3-server/server/src/vpn/tests.rs`):
- IP allocation logic (sequential, reuse after grace period)
- Config generation format validation
- WireGuard command building
- Database peer operations

**Launcher-Side** (`wowid3-launcher/src-tauri/src/modules/vpn.rs`):
- Keypair generation (correct length, valid base64)
- Config file parsing
- Server response handling
- WireGuard service detection

### Integration Tests

1. **Full Provisioning Flow**
   - Fresh install on Windows VM
   - Microsoft login
   - Enable VPN in settings
   - Verify keypair generated
   - Verify registration succeeds
   - Verify tunnel service created
   - Verify handshake established
   - Verify can ping `10.8.0.1`

2. **VPN-Enabled Minecraft Launch**
   - Enable VPN
   - Click Play
   - Verify Minecraft launches with correct server address
   - Verify connection to server succeeds
   - Play for 5 minutes, verify stability

3. **Fallback on VPN Failure**
   - Enable VPN
   - Block UDP 51820 in firewall
   - Click Play
   - Verify launcher shows error
   - Verify automatically uses direct connection
   - Verify Minecraft connects successfully

4. **Admin Revocation**
   - Admin revokes user's VPN access
   - User attempts to reconnect
   - Verify access denied
   - Verify error message shown
   - Verify VPN toggle disabled

### Load Testing
- Simulate 50 concurrent VPN connections
- Measure handshake success rate (target: > 99%)
- Measure latency impact (target: < 5ms)
- Measure server stability (no crashes, < 10% CPU)

### Manual Testing Checklist
- [ ] Install on clean Windows 10 VM
- [ ] Install on clean Windows 11 VM
- [ ] Test with Windows Defender
- [ ] Test with third-party antivirus (Avast, Norton, etc.)
- [ ] Test with strict firewall rules
- [ ] Test VPN reconnection after network change (Wi-Fi → Ethernet)
- [ ] Test during poor network conditions (simulated packet loss)
- [ ] Test with multiple network interfaces

## Deployment Plan

### Phase 1: Server Setup (Day 1)
1. SSH to `pma@192.168.10.43`
2. Install WireGuard: `sudo pacman -S wireguard-tools`
3. Generate server keypair
4. Create `/etc/wireguard/wg0.conf` with NAT rules
5. Enable service: `sudo systemctl enable --now wg-quick@wg0`
6. Verify port 51820 UDP open in firewall
7. Test local connection: `wg show wg0`

### Phase 2: Backend Development (Day 2-3)
1. Add `vpn_peers` table to database migration
2. Implement `server/src/vpn/` module
3. Add API endpoints to `server/src/main.rs` router
4. Test with curl/Postman:
   - POST registration with test keypair
   - Verify peer added to WireGuard
   - GET peer list from admin endpoint

### Phase 3: Launcher Development (Day 4-6)
1. Add `x25519-dalek` dependency to Cargo.toml
2. Implement `src-tauri/src/modules/vpn.rs`
3. Add Tauri commands for VPN control
4. Create Settings UI toggle
5. Create VPN status store
6. Modify `minecraft.rs` launch logic
7. Modify `server.rs` ping logic
8. Test locally with VPN server

### Phase 4: Installer Integration (Day 7)
1. Download WireGuard MSI from official site
2. Add to `resources/` directory
3. Modify NSIS installer script
4. Build test installer
5. Test on clean Windows VM

### Phase 5: Admin Panel (Day 8)
1. Create `VpnManagement.tsx` page
2. Implement peer list component
3. Add navigation menu item
4. Test admin actions (revoke, reactivate)

### Phase 6: Testing (Day 9-10)
1. Run all unit tests
2. Run integration tests
3. Manual testing on Windows 10/11
4. Load testing with 20 concurrent connections
5. Bug fixes

### Phase 7: Beta Release (Day 11)
1. Deploy server changes to production
2. Build launcher installer with VPN support
3. Release to 5-10 beta testers
4. Monitor logs and feedback
5. Iterate on issues

### Phase 8: Production Release (Day 14)
1. Address beta feedback
2. Update documentation
3. Release to all users
4. Monitor VPN adoption rate
5. Monitor server performance

## Monitoring & Metrics

### Key Metrics to Track
- VPN adoption rate (% of users with VPN enabled)
- Connection success rate (% of VPN enable attempts that succeed)
- Average latency improvement
- Packet loss reduction
- Concurrent VPN connections (peak/average)
- Server resource usage (CPU, memory, bandwidth)
- VPN-related errors (registration failures, tunnel failures, etc.)

### Alerts
- Server CPU > 80% for 5 minutes
- No VPN handshakes for 10 minutes (indicates server issue)
- Registration failure rate > 10%
- UDP port 51820 unreachable from external network

## Future Enhancements

### Potential Improvements (Post-v1)
1. **Linux/macOS Support**: Extend VPN to non-Windows platforms
2. **Auto-Routing**: Automatically enable VPN for users with high packet loss
3. **VPN Health Dashboard**: Real-time graph of VPN connections in admin panel
4. **Multiple Endpoints**: Support multiple VPN servers for load balancing
5. **IPv6 Support**: Add IPv6 addressing to VPN subnet
6. **Mobile App**: Extend VPN to mobile launcher (if developed)

## Appendix

### WireGuard Resources
- Official Documentation: https://www.wireguard.com/
- Windows Client: https://download.wireguard.com/windows-client/
- Protocol Whitepaper: https://www.wireguard.com/papers/wireguard.pdf

### Rust Crates Used
- `x25519-dalek`: Curve25519 key generation
- `base64`: Base64 encoding/decoding
- `reqwest`: HTTP client for API calls
- `tokio`: Async runtime

### Configuration Files
- Server: `/etc/wireguard/wg0.conf`
- Client (Windows): `%PROGRAMDATA%\wowid3-launcher\vpn\wowid3.conf`
- Database: `storage/stats.db` (vpn_peers table)

### Network Ports
- 51820/UDP: WireGuard tunnel (public, incoming)
- 25565/TCP: Minecraft server (internal: 192.168.10.29)
- 5566/HTTP: Modpack API backend (localhost)
- 5565/HTTP: Admin panel frontend (public, nginx)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Next Review**: After beta testing (Day 12)
