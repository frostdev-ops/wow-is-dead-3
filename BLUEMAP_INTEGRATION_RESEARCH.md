# BlueMap Integration for WOWID3 Launcher - Comprehensive Technical Analysis

## Executive Summary

BlueMap is a powerful Minecraft mapping tool that generates interactive 3D web-based maps of Minecraft worlds. It runs as a plugin/mod on the Minecraft server and includes a built-in web server. The WOWID3 launcher can integrate BlueMap in multiple ways, each with different trade-offs in complexity, functionality, and user experience.

---

## 1. BLUEMAP ARCHITECTURE & COMPONENTS

### 1.1 What BlueMap Does

BlueMap is a **map rendering and web serving system** that:
- Reads Minecraft world files from the server filesystem
- Generates 3D models and textures of the world surface asynchronously
- Serves an interactive web UI via a built-in HTTP server (default port 8100)
- Displays live player positions and custom markers
- Updates in real-time as chunks are generated or modified in-game

**Important**: BlueMap is NOT a Minecraft server manager. It cannot execute commands, manage players, or control server state. It's purely for visualization and tracking.

### 1.2 Deployment Models

BlueMap can run in multiple ways:

| Model | Typical Use | Architecture |
|-------|-----------|--------------|
| **Spigot/Paper Plugin** | Most common | Runs inside Minecraft server process |
| **Fabric/Forge Mod** | Alternative | Runs inside Minecraft client or server |
| **Standalone CLI** | Offline rendering | Standalone Java application |
| **Docker** | Container deployments | Containerized rendering service |

For WOWID3, BlueMap runs as a **server plugin on the Minecraft server**, separate from the launcher.

### 1.3 File Structure & Storage

```
BlueMap Installation Directory Structure:
├── plugins/BlueMap/               # BlueMap configuration
│   ├── config.conf                # Main configuration
│   ├── webserver.conf             # Web server settings (IP, port)
│   ├── maps/
│   │   └── {world-name}.conf      # Per-map configuration
│   └── markers/                   # Marker data files
├── bluemap/
│   ├── web/                       # Web application root
│   │   ├── index.html
│   │   ├── maps/                  # Generated map data
│   │   │   └── {world}/
│   │   │       ├── tiles/         # Map tiles (PNG, PRBM)
│   │   │       │   ├── 0/         # Zoom level
│   │   │       │   │   ├── x{}/   # X coordinate groups
│   │   │       │   │   │   └── z{}.prbm.gz
│   │   │       │   │   └── ...
│   │   │       ├── textures.json  # Texture metadata
│   │   │       ├── live/          # Live data (players, markers)
│   │   │       │   ├── players.json
│   │   │       │   └── markers.json
│   │   │       └── ...
│   │   └── lang/                  # Localization files
│   └── data/                      # Persistent data
```

### 1.4 Data Files and Formats

| File Type | Format | Purpose | Compression |
|-----------|--------|---------|-------------|
| **Tile tiles (low-res)** | PNG | Quick preview/overview | None |
| **Tile tiles (high-res)** | PRBM (binary) | Detailed 3D geometry | GZip (.gz) |
| **Textures** | JSON | Minecraft block textures | GZip (.gz) |
| **Live players** | JSON | Current player positions | Dynamic |
| **Live markers** | JSON | Custom markers/POIs | Dynamic |
| **Config files** | HOCON | Configuration (readable text) | None |

**Key Detail**: PRBM is a binary format (modified PRWM - Portable Raw WebGL Model). It's optimized for WebGL streaming and much smaller than JSON equivalents.

---

## 2. WEB SERVER & API ENDPOINTS

### 2.1 Built-in Web Server

**Default Configuration:**
- **Port**: 8100 (configurable in `webserver.conf`)
- **IP Binding**: `0.0.0.0` (all interfaces) by default, can be restricted to `127.0.0.1`
- **Root Directory**: `./bluemap/web/`
- **Technology**: Built-in Java HTTP server (part of BlueMap)

**Configuration Example** (`plugins/BlueMap/webserver.conf`):
```hocon
# Set to 127.0.0.1 to make local-only, 0.0.0.0 for external access
ip: "127.0.0.1"
port: 8100
enabled: true

# Enable live player tracking
liveUpdates: true
write-players-interval: 1000  # milliseconds
```

### 2.2 Available Endpoints

#### Static Map Data Endpoints

```
GET /                           # Main BlueMap web UI
GET /maps/{mapId}/             # Map root for specific world
GET /maps/{mapId}/tiles/{z}/{x}/{y}.png     # Low-res tiles
GET /maps/{mapId}/tiles/{z}/{x}/{y}.prbm    # High-res tiles (served from .prbm.gz)
GET /maps/{mapId}/textures.json             # Texture metadata
GET /maps/{mapId}/config.json               # Map configuration
```

#### Live Data Endpoints

```
GET /maps/{mapId}/live/players.json    # Current player positions (rate-limited to 1 sec)
GET /maps/{mapId}/live/markers.json    # Custom markers
GET /maps/{mapId}/live/              # Directory of all live data
```

#### Server Status

```
GET /health                    # Basic server health check
```

### 2.3 Tile Coordinate System

Tiles are organized hierarchically:
```
/maps/world/tiles/
├── 0/           # Zoom level 0 (highest detail)
│   ├── x9/
│   │   ├── z-8.prbm.gz
│   │   ├── z-7.prbm.gz
│   │   └── ...
│   ├── x10/
│   │   └── ...
│   └── ...
├── 1/           # Zoom level 1 (lower detail)
│   └── ...
└── ...
```

Coordinates follow Minecraft world coordinates but mapped to a Web Mercator-like projection.

### 2.4 JSON Response Examples

**players.json** format:
```json
{
  "version": 1,
  "players": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "name": "PlayerName",
      "position": [100.5, 64.0, -200.3],
      "health": 20,
      "armor": 10,
      "skin": "https://..."
    }
  ]
}
```

**markers.json** format:
```json
{
  "version": 1,
  "markerSets": {
    "set-id": {
      "label": "Points of Interest",
      "toggleable": true,
      "defaultHidden": false,
      "markers": {
        "poi-1": {
          "position": [100, 64, 200],
          "label": "Spawn",
          "type": "POI",
          "icon": "assets/icon.svg",
          "minDistance": 0,
          "maxDistance": 1000
        }
      }
    }
  }
}
```

---

## 3. INTEGRATION METHODS FOR WOWID3 LAUNCHER

### 3.1 Method 1: Embedded Webview (Localhost) - RECOMMENDED

**Approach**: Tauri loads BlueMap's web UI from `http://localhost:8100` in a Tauri webview window.

#### Architecture Diagram
```
WOWID3 Launcher (Tauri)
├── Main Window (React UI)
│   └── Button: "Open Map"
└── Child Webview Window
    └── Loads http://localhost:8100
        ↓ (fetches from)
    BlueMap Web Server (port 8100)
        ↓ (serves static files & live data)
    BlueMap Plugin (on Minecraft Server)
```

#### Implementation Steps

**1. Rust Backend (src-tauri/src/modules/)**
Create a new module `map_viewer.rs`:

```rust
use tauri::WebviewWindowBuilder;
use std::time::Duration;

#[tauri::command]
pub async fn open_map_viewer(handle: tauri::AppHandle) -> Result<(), String> {
    // Verify BlueMap is accessible
    let response = reqwest::Client::new()
        .get("http://localhost:8100/health")
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .map_err(|e| format!("BlueMap not accessible: {}", e))?;
    
    if !response.status().is_success() {
        return Err("BlueMap server returned error".to_string());
    }

    // Create child webview
    WebviewWindowBuilder::new(
        &handle,
        "bluemap",
        tauri::WebviewUrl::External("http://localhost:8100".parse().unwrap()),
    )
    .title("BlueMap - Server Map")
    .inner_size(1200.0, 800.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_map_viewer(handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = handle.get_webview_window("bluemap") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn check_bluemap_available() -> Result<bool, String> {
    match reqwest::Client::new()
        .get("http://localhost:8100/health")
        .timeout(Duration::from_secs(2))
        .send()
        .await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}
```

**2. React Frontend Hook (src/hooks/useMapViewer.ts)**

```typescript
import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback } from "react";

export function useMapViewer() {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isBlueMapAvailable, setIsBlueMapAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if BlueMap is available on startup
  const checkAvailability = useCallback(async () => {
    try {
      const available = await invoke<boolean>("check_bluemap_available");
      setIsBlueMapAvailable(available);
    } catch (err) {
      console.error("Error checking BlueMap availability:", err);
      setIsBlueMapAvailable(false);
    }
  }, []);

  const openMapViewer = useCallback(async () => {
    try {
      await invoke("open_map_viewer");
      setIsMapOpen(true);
      setError(null);
    } catch (err) {
      const message = typeof err === "string" ? err : "Failed to open map";
      setError(message);
      console.error("Error opening map:", err);
    }
  }, []);

  const closeMapViewer = useCallback(async () => {
    try {
      await invoke("close_map_viewer");
      setIsMapOpen(false);
    } catch (err) {
      console.error("Error closing map:", err);
    }
  }, []);

  return {
    isMapOpen,
    isBlueMapAvailable,
    error,
    checkAvailability,
    openMapViewer,
    closeMapViewer,
  };
}
```

**3. React Component (src/components/MapViewerButton.tsx)**

```typescript
import React, { useEffect } from "react";
import { useMapViewer } from "../hooks/useMapViewer";
import { Button } from "./ui/Button";

export function MapViewerButton() {
  const { isBlueMapAvailable, openMapViewer, error } = useMapViewer();

  useEffect(() => {
    // Optional: Check availability on component mount
    // checkAvailability();
  }, []);

  if (!isBlueMapAvailable) {
    return (
      <Button disabled title="BlueMap server is not running">
        Map Viewer Unavailable
      </Button>
    );
  }

  return (
    <div>
      <Button onClick={openMapViewer} className="map-viewer-btn">
        Open Server Map
      </Button>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
```

#### Advantages
- ✅ **No Firewall Issues**: Localhost only, completely internal
- ✅ **Native Integration**: BlueMap UI runs inside Tauri window
- ✅ **Low Latency**: Direct local connection
- ✅ **Offline Capable**: Works when disconnected from network
- ✅ **Real-time Updates**: Live player/marker data via HTTP polling
- ✅ **Security**: No external access, contained environment
- ✅ **Full Features**: Access to all BlueMap functionality

#### Disadvantages
- ❌ **BlueMap Must Run**: Requires BlueMap plugin running on Minecraft server
- ❌ **Localhost Only**: Cannot access from other machines
- ❌ **Platform Differences**: Linux X11/Wayland may have webview issues
- ❌ **Child Window Limitations**: X11 only on Linux, not Wayland

#### Platform Considerations

**Linux (Tauri 2.x)**:
- Child webviews work on X11 only
- On Wayland, use a separate window instead of child webview
- May need to disable DMABUF renderer (as in your .env.wayland)

**Windows/macOS**: Works without issues

**Recommended Windows Configuration** (Tauri.conf.json):
```json
{
  "windows": [
    {
      "label": "main",
      "title": "WOWID3 Launcher",
      "width": 1200,
      "height": 800
    }
  ],
  "build": {
    "webviewInstallMode": "offlineRequired"
  }
}
```

---

### 3.2 Method 2: External Browser Link - SIMPLEST

**Approach**: Provide a button that opens BlueMap in the system's default web browser.

#### Implementation

**Rust Command**:
```rust
#[tauri::command]
pub async fn open_map_in_browser(server_ip: String) -> Result<(), String> {
    let url = format!("http://{}:8100", server_ip);
    
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd")
        .args(&["/C", "start", &url])
        .spawn()
        .map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
```

**React Component**:
```typescript
export function ExternalMapButton() {
  const [serverIp, setServerIp] = useState("localhost");

  const handleClick = async () => {
    try {
      await invoke("open_map_in_browser", { serverIp });
    } catch (err) {
      console.error("Error opening map:", err);
    }
  };

  return <Button onClick={handleClick}>Open Map in Browser</Button>;
}
```

#### Advantages
- ✅ **Simple Implementation**: Minimal code, no webview complexity
- ✅ **No Platform Issues**: Uses system browser (always works)
- ✅ **User Control**: User can manage window themselves
- ✅ **Independent**: Launcher doesn't need to manage window

#### Disadvantages
- ❌ **Poor UX**: Launches external app, breaks workflow
- ❌ **No Integration**: Feels disconnected from launcher
- ❌ **Network Required**: Needs network access (localhost won't work remotely)
- ❌ **No Real-time Sync**: Launcher doesn't track map state

#### Best For
- **Quick MVP**: Get something working immediately
- **Network Play**: When server is on different machine
- **Accessibility**: Letting users manage their own viewing preferences

---

### 3.3 Method 3: Static Web UI Bundle - ADVANCED

**Approach**: Extract and embed BlueMap's static web files in the launcher, create a local HTTP server in Rust.

#### Architecture
```
WOWID3 Launcher
├── static/bluemap/     # Embedded BlueMap web UI
│   ├── index.html
│   ├── js/
│   ├── css/
│   └── assets/
└── Rust HTTP Server (port 8101)
    ├── Serves static files
    ├── Proxies /maps/* to BlueMap (8100)
    └── Handles authentication (optional)
```

#### Implementation Outline

**Rust HTTP Server** (uses `axum` - already in your server):
```rust
use axum::{
    routing::get,
    http::StatusCode,
    response::IntoResponse,
    Router,
};
use std::net::SocketAddr;

pub async fn start_embedded_map_server() -> Result<(), Box<dyn std::error::Error>> {
    // Serve embedded static files
    let app = Router::new()
        .nest_service(
            "/",
            tower_http::services::ServeDir::new("embedded_bluemap"),
        )
        // Proxy /maps/* to local BlueMap
        .fallback(proxy_to_bluemap);
    
    let addr = SocketAddr::from(([127, 0, 0, 1], 8101));
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    
    axum::serve(listener, app).await?;
    Ok(())
}

async fn proxy_to_bluemap(req: axum::http::Request<axum::body::Body>) -> impl IntoResponse {
    // Proxy request to http://localhost:8100
    // Implementation using reqwest
}
```

#### Advantages
- ✅ **Custom UI**: Can modify BlueMap interface
- ✅ **No BlueMap Web Server**: Don't need BlueMap's server
- ✅ **Full Control**: Own the entire web stack
- ✅ **Optimization**: Can customize for launcher needs

#### Disadvantages
- ❌ **Complex**: Requires HTTP server setup
- ❌ **Maintenance**: Need to maintain bundled BlueMap version
- ❌ **Build Size**: Increases launcher binary size
- ❌ **Process Management**: Manage server lifecycle
- ❌ **CORS Issues**: May need proxy configuration

#### Best For
- **Custom Branding**: Want to customize the UI heavily
- **Offline Distribution**: Need to work without BlueMap's web server
- **Advanced Features**: Need server-side processing

---

### 3.4 Method 4: Direct API Integration - CUSTOM

**Approach**: Build a custom map viewer in React that fetches raw data from BlueMap's HTTP endpoints.

#### Architecture
```
React Map Component
├── Fetch /maps/{world}/tiles/{z}/{x}/{y}.png  → Display canvas/WebGL
├── Fetch /maps/{world}/live/players.json      → Update player positions
├── Fetch /maps/{world}/live/markers.json      → Update markers
└── Three.js/Canvas
    └── Render custom 3D view (optional)
```

#### Implementation Example

```typescript
import React, { useEffect, useState } from "react";
import axios from "axios";

interface Player {
  uuid: string;
  name: string;
  position: [number, number, number];
}

export function CustomMapViewer({ serverUrl = "http://localhost:8100" }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mapData, setMapData] = useState<any>(null);

  // Fetch live player data
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(
          `${serverUrl}/maps/world/live/players.json`
        );
        setPlayers(response.data.players || []);
      } catch (err) {
        console.error("Error fetching players:", err);
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [serverUrl]);

  // Fetch map configuration
  useEffect(() => {
    const fetchMapConfig = async () => {
      try {
        const response = await axios.get(
          `${serverUrl}/maps/world/config.json`
        );
        setMapData(response.data);
      } catch (err) {
        console.error("Error fetching map config:", err);
      }
    };

    fetchMapConfig();
  }, [serverUrl]);

  return (
    <div className="custom-map-viewer">
      <h2>Server Players: {players.length}</h2>
      <ul>
        {players.map((player) => (
          <li key={player.uuid}>
            {player.name} at [{player.position[0].toFixed(1)},
            {player.position[2].toFixed(1)}]
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### Advantages
- ✅ **Complete Control**: Design UI exactly as desired
- ✅ **Customizable**: Can add launcher-specific features
- ✅ **Lightweight**: Minimal dependencies
- ✅ **Real-time**: Live updates via polling
- ✅ **No Sub-window**: Seamless integration in main UI

#### Disadvantages
- ❌ **Major Development**: Large implementation effort
- ❌ **Feature Gaps**: May miss BlueMap's advanced features
- ❌ **Tile Rendering**: PRBM format is complex to render
- ❌ **3D Rendering**: Would need Three.js for proper 3D
- ❌ **Maintenance**: Must keep up with BlueMap updates

#### Best For
- **Custom HUD**: Want deeply integrated player tracker
- **Mobile-Friendly**: Need responsive map display
- **Minimal Features**: Only need basic player/marker display

---

## 4. REAL-TIME DATA UPDATES

### 4.1 Data Refresh Mechanisms

BlueMap provides **HTTP polling** for live data (no WebSocket currently):

```
Players Update: GET /maps/{world}/live/players.json
  ├── Rate-limited: 1 second minimum interval
  └── Response includes: UUID, name, position [x, y, z], health, armor

Markers Update: GET /maps/{world}/live/markers.json
  ├── Rate-limited: Variable (typically 5-10 seconds)
  └── Response includes: All marker sets and their markers

Tiles Update: GET /maps/{world}/tiles/{z}/{x}/{y}.prbm
  ├── On-demand fetching
  └── Cached by browser (refresh only when chunk changed)
```

### 4.2 Configuration for Live Data

In `plugins/BlueMap/webserver.conf`:

```hocon
# Enable live updates
liveUpdates: true

# Player tracking
write-players-interval: 1000   # milliseconds (1 second)

# Custom markers
write-markers-interval: 5000   # milliseconds (5 seconds)

# Automatic flush to disk
auto-save-interval: 10000      # milliseconds (10 seconds)
```

### 4.3 Polling Implementation Example

```typescript
// Auto-refresh player data
useEffect(() => {
  const pollPlayers = async () => {
    try {
      const response = await fetch("http://localhost:8100/maps/world/live/players.json");
      const data = await response.json();
      setPlayers(data.players || []);
    } catch (err) {
      console.error("Error fetching players:", err);
    }
  };

  const interval = setInterval(pollPlayers, 1000); // Poll every second
  return () => clearInterval(interval);
}, []);
```

### 4.4 Future: WebSocket Support

Currently, there's a **feature request** for WebSocket support in BlueMap to reduce polling overhead. Monitor GitHub issue #244 for updates.

---

## 5. AUTHENTICATION & SECURITY CONSIDERATIONS

### 5.1 BlueMap's Security Model

**Important**: BlueMap has **no built-in authentication**. Security must be implemented externally:

1. **Localhost-Only Access** (Recommended for WOWID3)
   - Bind to `127.0.0.1` in `webserver.conf`
   - Only accessible locally on the machine
   - No external access possible
   - Perfect for single-user launcher

2. **Network Access** (Requires Proxy)
   - Bind to specific IP or `0.0.0.0`
   - Use reverse proxy (NGINX/Apache) with authentication
   - Implement HTTP Basic Auth or JWT tokens
   - Control at proxy level, not BlueMap level

3. **Third-Party Authentication**
   - Community plugin "Auth" by Chicken for Minecraft player auth
   - Links web sessions to player UUIDs
   - Requires proxy configuration

### 5.2 Security Recommendations for WOWID3

**Best Practice Setup**:

```hocon
# plugins/BlueMap/webserver.conf
ip: "127.0.0.1"      # Localhost only
port: 8100           # Internal port
enabled: true
liveUpdates: true    # Safe: only internal access
```

This configuration:
- Prevents external access to map data
- No CORS needed (same origin)
- No authentication layer required
- User information (if enabled) stays local

**If Network Access Needed**:

1. Use reverse proxy with authentication
2. Configure CORS headers properly
3. Validate origin on BlueMap server
4. Consider VPN tunnel for remote access

### 5.3 Data Privacy

**Information Exposed by BlueMap** (if live updates enabled):
- Player names and positions
- Minecraft player UUIDs
- Player skins (downloaded from Mojang)
- Custom markers and labels
- World render (visual data)

**Mitigation for Single-Player Launcher**:
- Localhost-only binding (default recommendation)
- No external network exposure
- No CORS issues
- User controls the data

---

## 6. MARKER SYSTEM & CUSTOMIZATION

### 6.1 Marker Types

BlueMap supports **5 marker types**:

| Type | Purpose | Use Case |
|------|---------|----------|
| **POI** | Single point with icon | Landmarks, shops, bases |
| **HTML** | Custom HTML element | Rich information displays |
| **Line** | Connect multiple points | Paths, routes, roads |
| **Shape** | Flat polygon | Area boundaries, claims |
| **Extrude** | 3D box between heights | Structures, volume claims |

### 6.2 Marker Storage

**Static Markers** (Persistent):
- Defined in map `.conf` file: `plugins/BlueMap/maps/{world}.conf`
- Manually edited or via admin plugin
- Persists across restarts

**Dynamic Markers** (API-based):
- Created via BlueMapAPI from plugins
- **NOT persisted by BlueMap** - plugins must save/load themselves
- Regenerated on each plugin load
- Requires custom persistence layer

### 6.3 Marker Data Format (markers.json)

```json
{
  "version": 1,
  "markerSets": {
    "towns": {
      "label": "Towns",
      "toggleable": true,
      "defaultHidden": false,
      "markers": {
        "spawn-town": {
          "type": "POI",
          "position": [100, 64, 200],
          "label": "Spawn Town",
          "icon": "assets/home.svg",
          "anchor": [0.5, 1.0],
          "minDistance": 0,
          "maxDistance": 999999
        },
        "wild-path": {
          "type": "Line",
          "position": [[100, 64, 200], [500, 64, 500]],
          "label": "Path to Wild",
          "strokeColor": "#ff6600",
          "strokeWeight": 3
        },
        "claim-area": {
          "type": "Shape",
          "position": [
            [[100, 100], [200, 100], [200, 200], [100, 200]]
          ],
          "label": "Town Claim",
          "fillColor": "#0066ff",
          "fillOpacity": 0.3,
          "strokeColor": "#0066ff"
        }
      }
    }
  }
}
```

### 6.4 Custom Markers from WOWID3

**Option 1**: Use BlueMapAPI from a server plugin
```java
// In your BlueMap-aware plugin
BlueMapAPI.getInstance().ifPresent(api -> {
    Optional<BlueMapMap> mapOpt = api.getMap("world");
    mapOpt.ifPresent(map -> {
        MarkerSet markerSet = new MarkerSet("wowid3-players");
        markerSet.setLabel("WOWID3 Players");
        
        POIMarker playerMarker = new POIMarker(
            "player-uuid",
            new Vector3f(x, y, z),
            "PlayerName"
        );
        markerSet.put("player-uuid", playerMarker);
        map.getMarkerSets().put("wowid3-players", markerSet);
    });
});
```

**Option 2**: Directly modify markers.json via HTTP
If BlueMap allows POST/PUT (check version):
```typescript
const newMarker = {
  type: "POI",
  position: [playerX, playerY, playerZ],
  label: playerName,
  icon: "assets/player.svg"
};

// This may require custom implementation or plugins
fetch("http://localhost:8100/maps/world/live/markers.json", {
  method: "PUT",
  body: JSON.stringify(markerData)
});
```

---

## 7. IMPLEMENTATION RECOMMENDATIONS FOR WOWID3

### 7.1 Recommended Approach: Method 1 (Embedded Webview)

**Rationale**:
1. ✅ Best user experience - integrated into launcher
2. ✅ Secure - localhost only, no firewall issues
3. ✅ Real-time - live player/marker updates
4. ✅ Works offline - no network dependency
5. ✅ Low complexity - leverages existing Tauri setup

**Implementation Priority**:
1. **Phase 1**: Basic webview integration
   - Open BlueMap in child window
   - Availability check
   - Basic error handling

2. **Phase 2**: Enhanced features
   - Custom theme integration
   - Player filtering
   - Marker management UI

3. **Phase 3**: Advanced integration
   - Custom player tracking markers
   - Real-time notifications
   - Performance optimizations

### 7.2 Configuration Checklist

**Server-Side** (Minecraft Server):
```hocon
# plugins/BlueMap/webserver.conf
enabled: true
ip: "127.0.0.1"           # Localhost only
port: 8100                # Default port
liveUpdates: true         # Enable live data
write-players-interval: 1000
write-markers-interval: 5000
```

**Launcher-Side** (WOWID3):
1. Add `map_viewer.rs` module to Tauri backend
2. Create `useMapViewer.ts` hook
3. Add UI button/component for opening map
4. Add availability check on app startup
5. Configure Tauri window for BlueMap (child webview or separate window)

### 7.3 Code Location in WOWID3

**Suggested File Structure**:
```
wowid3-launcher/
├── src-tauri/src/modules/
│   ├── mod.rs                 (add: pub mod map_viewer;)
│   └── map_viewer.rs          (new file)
├── src/hooks/
│   └── useMapViewer.ts        (new file)
├── src/components/
│   └── MapViewerButton.tsx    (new file)
└── src-tauri/tauri.conf.json  (configure webview)
```

### 7.4 Example Integration with Existing Components

**Add to Navigation.tsx**:
```typescript
import { MapViewerButton } from "./MapViewerButton";

export function Navigation() {
  return (
    <nav>
      {/* existing nav items */}
      <MapViewerButton />
    </nav>
  );
}
```

**Add to LauncherHome.tsx**:
```typescript
import { MapViewerButton } from "./MapViewerButton";

export function LauncherHome() {
  return (
    <div>
      {/* existing home content */}
      <section className="map-section">
        <h3>Server Map</h3>
        <MapViewerButton />
      </section>
    </div>
  );
}
```

---

## 8. TROUBLESHOOTING & COMMON ISSUES

### 8.1 BlueMap Not Accessible

**Symptom**: "BlueMap server not found" error

**Solutions**:
```rust
// Check BlueMap is running
1. Verify BlueMap plugin is loaded on server: /bluemap status
2. Check port is correct: 8100 (or configured value)
3. Verify binding: ip: "127.0.0.1" in webserver.conf
4. Check firewall doesn't block 127.0.0.1:8100
5. Restart BlueMap: /bluemap reload
```

### 8.2 Tiles Not Loading ("Black Map")

**Symptom**: Map loads but tiles appear black or missing

**Causes & Solutions**:
- **Rendering not complete**: Wait for BlueMap to render chunks
  - Check: `/bluemap status`
  - Solution: Run `/bluemap render` command on server
  
- **PRBM file serving issue**: Occurs with external webservers
  - Only happens if using NGINX/Apache, not internal server
  - Solution: Configure gzip_static (NGINX) or Headers (Apache)

- **WebGL not supported**: Older browsers/systems
  - Check browser console for errors
  - Update WebGL drivers

### 8.3 Live Data Not Updating

**Symptom**: Players don't move, markers not refreshing

**Solutions**:
```hocon
# Check webserver.conf
enabled: true
liveUpdates: true
write-players-interval: 1000    # In milliseconds
write-markers-interval: 5000
auto-save-interval: 10000
```

- Verify intervals are reasonable (not too high)
- Check `/bluemap status` shows live updates enabled
- Verify HTTP polling is happening (check network tab in browser dev tools)

### 8.4 Webview Window Won't Open (Linux)

**Symptom**: Error opening child webview on Linux

**Cause**: Wayland doesn't support child webviews (only X11)

**Solution 1**: Create separate window instead of child
```rust
WebviewWindowBuilder::new(&handle, "bluemap", ...)
// This works on all platforms
```

**Solution 2**: Use X11 instead of Wayland
```bash
GDK_BACKEND=x11 npm run tauri:dev
```

**Solution 3**: Load in iframe instead
- Not recommended due to CORS issues with localhost

---

## 9. DEPLOYMENT CONSIDERATIONS

### 9.1 Production BlueMap Setup

**Recommended Configuration**:
```hocon
# plugins/BlueMap/webserver.conf
enabled: true
ip: "127.0.0.1"           # Local-only
port: 8100                # Or any available port
webroot: "./bluemap/web"

# Rendering performance
render-thread-count: 4    # Adjust based on server CPU

# Live updates
liveUpdates: true
write-players-interval: 1000
write-markers-interval: 5000

# Storage
storage: "file"           # Use file storage (default)
```

### 9.2 Resource Requirements

**BlueMap Server Requirements**:
- **Disk Space**: 1-10 GB per world (depending on size)
  - 1GB typical for smaller worlds (~5000x5000 blocks)
  - 5-10GB for larger exploration
  
- **CPU**: Multi-core recommended
  - Rendering uses multiple threads
  - Async, doesn't block server thread
  
- **Memory**: 256MB - 1GB
  - Configurable based on chunk cache size
  
- **Network**: Bandwidth for tile serving
  - Initial load: 10-100 MB per player
  - Ongoing: 1-10 MB per session

---

## 10. COMPARISON MATRIX: INTEGRATION METHODS

| Feature | Method 1: Webview | Method 2: Browser | Method 3: Bundle | Method 4: Custom |
|---------|-------------------|------------------|------------------|-----------------|
| **Ease of Implementation** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ |
| **User Experience** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Real-time Updates** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Works Offline** | ✅ Yes | ⚠️ Localhost only | ✅ Yes | ✅ Yes |
| **Security** | ✅ Localhost | ✅ Localhost | ✅ Localhost | ✅ Localhost |
| **Feature Complete** | ✅ Full | ✅ Full | ✅ Full | ⚠️ Limited |
| **Maintenance** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Binary Size Impact** | Minimal | None | +50-100MB | Minimal |
| **Platform Support** | ⚠️ X11 only (Linux) | ✅ All | ✅ All | ✅ All |
| **Development Time** | ~4-6 hours | ~1-2 hours | ~16-24 hours | ~40+ hours |

---

## 11. DEPENDENCIES & LIBRARIES

### For Method 1 Implementation (Recommended)

**Rust Backend**:
- `reqwest`: HTTP client (already in WOWID3 server)
- `tauri`: Already in your project
- `tokio`: Async runtime (already available)

**React Frontend**:
- Zustand (for state management - already used)
- Axios (for HTTP requests - add if needed)
- React hooks (standard library)

**No new major dependencies needed** - can reuse existing stack!

### Optional Enhancements

- `serde_json`: JSON parsing (already available)
- `dashmap`: Concurrent HashMap for caching (optional)

---

## 12. NEXT STEPS FOR IMPLEMENTATION

### Immediate (Week 1)
1. **Add Rust module**: `src-tauri/src/modules/map_viewer.rs`
2. **Register command**: Update `src-tauri/src/lib.rs`
3. **Create React hook**: `src/hooks/useMapViewer.ts`
4. **Add UI component**: `src/components/MapViewerButton.tsx`
5. **Test locally**: Verify BlueMap integration works

### Short-term (Week 2-3)
1. **Enhanced error handling**: Better user-facing error messages
2. **Auto-start detection**: Check BlueMap availability on app start
3. **Settings integration**: Let users configure map server IP/port
4. **Theme matching**: Adapt BlueMap UI colors to launcher theme

### Medium-term (Month 1-2)
1. **Custom markers**: Add player tracking markers from launcher
2. **Player list sync**: Show online players linked to map
3. **Performance optimization**: Cache player data, debounce updates
4. **Mobile support**: Consider responsive webview sizing

### Long-term (Ongoing)
1. **Marker API integration**: Create custom POI system
2. **Advanced analytics**: Track player movements, heatmaps
3. **WebSocket upgrade**: When BlueMap adds WebSocket support
4. **Third-party integration**: Connect with other server tools

---

## CONCLUSION

BlueMap integration is highly feasible for WOWID3. **Recommended approach: Method 1 (Embedded Webview)** provides the best balance of:
- ✅ User experience (integrated into launcher)
- ✅ Simplicity (leverages existing Tauri setup)
- ✅ Security (localhost-only, no firewall complexity)
- ✅ Features (full BlueMap functionality with real-time updates)
- ✅ Performance (minimal overhead, live data via HTTP polling)

**No new major dependencies** required - can implement entirely with Tauri, React, and existing libraries.

---

## APPENDIX: USEFUL LINKS

- **BlueMap Documentation**: https://bluemap.bluecolored.de/
- **BlueMapAPI GitHub**: https://github.com/BlueMap-Minecraft/BlueMapAPI
- **BlueMap GitHub**: https://github.com/BlueMap-Minecraft/BlueMap
- **Tauri Webview Docs**: https://v2.tauri.app/reference/javascript/api/namespacewebview/
- **Tauri IPC Guide**: https://v2.tauri.app/concept/inter-process-communication/

