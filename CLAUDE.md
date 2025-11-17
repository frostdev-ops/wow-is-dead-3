# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WOWID3 is a custom Minecraft launcher and server management system for a modded Minecraft server. The project consists of three main components:

1. **wowid3-launcher**: Tauri-based desktop application (Rust + React + TypeScript)
2. **wowid3-server**: Web-based server manager (Rust Axum backend + React frontend)
3. **wowid3-server-data**: Minecraft server data directory

## Core Technologies

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS 4, Vite 7, Zustand (state management)
- **Backend**: Rust (Tauri 2.x for launcher, Axum 0.7 for server manager)
- **Build Tools**: Cargo, npm, Vite
- **Desktop Framework**: Tauri 2.x with full Wayland support

## Development Commands

### Launcher (wowid3-launcher/)

```bash
# Development mode (standard)
npm run tauri:dev

# Development mode (Wayland-specific - required for many Linux systems)
source .env.wayland && npm run tauri:dev
# Or use the npm script:
npm run tauri:dev:wayland

# Build frontend only
npm run build

# Build production bundles (AppImage, deb, NSIS)
npm run tauri build

# Run frontend dev server without Tauri
npm run dev
```

**Important**: On Linux with Wayland, always use `.env.wayland` environment variables to avoid protocol errors. The launcher includes special environment variables to fix WebKit DMABUF renderer issues on NVIDIA systems.

### Server Manager (wowid3-server/)

```bash
# Start both backend and frontend (recommended)
./start.sh

# Backend only (from server/ directory)
cd server && cargo run

# Frontend only (from web/ directory)
cd web && npm run dev

# Build backend for production
cd server && cargo build --release

# Build frontend for production
cd web && npm run build
```

The `start.sh` script automatically starts both services and installs dependencies if needed.

## Architecture & Code Structure

### Launcher Architecture (wowid3-launcher/)

**Rust Backend (src-tauri/src/)**:
- `lib.rs`: Tauri commands registration and main entry point
- `modules/auth.rs`: Microsoft OAuth 2.0 authentication flow for Minecraft (uses PKCE, keyring storage)
- `modules/discord.rs`: Discord Rich Presence integration
- `modules/minecraft.rs`: Minecraft game launcher with JVM configuration
- `modules/server.rs`: Minecraft server status pinging
- `modules/updater.rs`: Modpack downloading, verification, and updating

**React Frontend (src/)**:
- `App.tsx`: Main application component with navigation
- `components/`: UI components
  - `LauncherHome.tsx`: Main launcher screen with play button, server status, user info
  - `SettingsScreen.tsx`: User settings and configuration
  - `ChangelogViewer.tsx`: Modpack changelog display
  - `Navigation.tsx`, `UserMenu.tsx`, `PlayerList.tsx`: Navigation and user interface components
  - `theme/`: Theme-specific components (Christmas theme with animated background)
  - `ui/`: Reusable UI components
- `hooks/`: Custom React hooks
  - `useAuth.ts`: Microsoft authentication state management
  - `useDiscord.ts`: Discord Rich Presence hooks
  - `useModpack.ts`: Modpack download and update management
  - `useServer.ts`: Server status polling
  - `useTauriCommands.ts`: Centralized Tauri command interface
  - `useTheme.ts`: Theme management (Christmas, light, dark themes)
- `stores/`: Zustand state management
  - `authStore.ts`: Authentication state
  - `modpackStore.ts`: Modpack state
  - `serverStore.ts`: Server status state
  - `settingsStore.ts`: User settings
- `themes/`: Theme definitions (christmas.json, light.json, dark.json)

**Key Patterns**:
- Tauri commands are defined in Rust and called from React via the `invoke` API
- All async operations use hooks that wrap Tauri commands
- State management uses Zustand for global state
- Credentials are stored securely in system keyring via the `keyring` crate

### Server Manager Architecture (wowid3-server/)

**Rust Backend (server/src/)**:
- `main.rs`: Axum server setup with CORS, routing, and middleware
- `modules/config.rs`: Environment-based configuration loading
- `modules/server_manager.rs`: Core server lifecycle management (start, stop, restart)
- `modules/process.rs`: Minecraft server process spawning and management
- `api/`: HTTP endpoint handlers
  - `server.rs`: Server control endpoints (start, stop, restart, command)
  - `logs.rs`: Log retrieval and SSE streaming
  - `stats.rs`: Server statistics (uptime, memory, CPU, player count)
- `models/`: Data models and serialization structs
- `utils/`: Utility functions (JAR file finding, etc.)

**React Frontend (web/src/)**:
- `App.tsx`: Main dashboard with server controls, logs, and stats
- `components/`: UI components for log viewing, server stats, controls
- `hooks/`: API interaction hooks
- `stores/`: State management
- `types/`: TypeScript type definitions

**Key Patterns**:
- Backend uses `Arc<RwLock<T>>` and `Arc<Mutex<T>>` for thread-safe shared state
- Server logs are streamed via Server-Sent Events (SSE)
- Frontend proxies `/api` requests to backend during development (port 5173 → 8080)
- Process output is captured via async channels (`mpsc::unbounded_channel`)

### Authentication Flow (Launcher)

The launcher uses a complete Microsoft OAuth 2.0 flow:

1. User clicks "Login with Microsoft"
2. OAuth flow with PKCE (Proof Key for Code Exchange)
3. Microsoft token → Xbox Live token
4. Xbox Live token → XSTS token
5. XSTS token → Minecraft access token
6. Minecraft token → Player profile and ownership verification

Tokens are stored in system keyring and automatically refreshed (with 5-minute buffer).

### Bundled Java Runtime

The launcher bundles Azul Zulu JVM 21 in `src-tauri/runtime/java/`. This ensures consistent Java versions across systems. The JVM path is hardcoded to use the bundled runtime.

### Discord Rich Presence

The launcher integrates Discord Rich Presence via the `discord-rich-presence` crate. Status updates show:
- Current game state (in menus, playing)
- Server name and player count
- Session start time

### Modpack System

Modpacks are defined via a `manifest.json` file containing:
- Modpack version
- List of files with URLs and SHA-256 checksums
- Changelog entries

The updater:
1. Fetches manifest from URL
2. Compares installed version vs. available version
3. Downloads only changed files
4. Verifies checksums
5. Reports progress via Tauri events

## Configuration

### Launcher

No `.env` file needed for basic operation. Configuration is handled via:
- System keyring for credentials
- Zustand stores for user preferences
- Tauri config for window/app settings

### Server Manager

Create `wowid3-server/server/.env` based on `.env.example`:

```env
SERVER_DIR=./server-data        # Path to Minecraft server
SERVER_PORT=25565               # Minecraft server port
API_PORT=8080                   # API server port
API_HOST=0.0.0.0               # Bind address
JAVA_PATH=java                 # Java executable
JVM_ARGS=-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200
MIN_RAM=2048                   # Minimum JVM heap (MB)
MAX_RAM=4096                   # Maximum JVM heap (MB)
RUST_LOG=info                  # Logging level
```

## Linux Wayland Support

The launcher requires special environment variables on Wayland to fix WebKit protocol errors:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1  # Fix for NVIDIA GPU users
GSK_RENDERER=ngl                  # Better Wayland compatibility
GDK_BACKEND=wayland,x11           # Fallback to X11 if Wayland fails
```

These are automatically set by:
- `.env.wayland` file (development)
- `wowid3-launcher.sh` wrapper script (production builds)

**Troubleshooting**: If you see "Error 71 (Protocol error) dispatching to Wayland display", ensure these variables are set. See [Tauri Issue #10702](https://github.com/tauri-apps/tauri/issues/10702).

## API Endpoints (Server Manager)

**Server Control**:
- `GET /api/server/status` - Current server status
- `POST /api/server/start` - Start server
- `POST /api/server/stop` - Stop server
- `POST /api/server/restart` - Restart server
- `POST /api/server/command` - Send console command (JSON: `{"command": "/say Hello"}`)

**Logs**:
- `GET /api/logs?tail=N` - Last N log lines
- `GET /api/logs/stream` - SSE stream for real-time logs

**Statistics**:
- `GET /api/stats` - Server stats (uptime, memory, CPU, player count)

## Testing

The project uses Rust's built-in testing framework:

```bash
# Run Rust tests in launcher
cd wowid3-launcher/src-tauri && cargo test

# Run Rust tests in server
cd wowid3-server/server && cargo test
```

Test dependencies are defined in `Cargo.toml`:
- `tempfile`: Temporary file/directory creation
- `wiremock`: HTTP mocking
- `tokio-test`: Async test utilities

## Common Development Patterns

1. **Adding a new Tauri command**:
   - Define the Rust function in appropriate `modules/*.rs` file
   - Add command to `lib.rs` and include in `.invoke_handler()`
   - Create corresponding hook in `src/hooks/useTauriCommands.ts`
   - Use hook in React components

2. **Adding server API endpoint**:
   - Create handler function in `api/*.rs`
   - Add route to router in `main.rs` via `.nest()` or `.route()`
   - Access via `/api/...` path (proxied in dev, direct in prod)

3. **State management**:
   - Launcher: Use Zustand stores in `src/stores/`
   - Server: Use `Arc<RwLock<T>>` or `Arc<Mutex<T>>` for shared state

4. **Error handling**:
   - Rust: Use `anyhow::Result<T>` for functions that can fail
   - Tauri commands: Return `Result<T, String>` (errors are serialized to strings)
   - React: Use `.catch()` on Tauri command promises

## Build Artifacts

- **Launcher**: AppImage, deb, NSIS installer in `src-tauri/target/release/bundle/`
- **Server**: Binary at `server/target/release/wowid3-server`

## Microsoft OAuth Client ID

The launcher uses the official Minecraft launcher client ID:
`cd1d612b-3203-4622-88d2-4d1f58fb7762`

This is publicly available and used by third-party launchers for Microsoft authentication.
