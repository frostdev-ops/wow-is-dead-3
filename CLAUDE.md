# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WOWID3 is a custom Minecraft launcher and modpack distribution system for a modded Minecraft server. The project consists of two main components:

1. **wowid3-launcher**: Tauri-based desktop application (Rust + React + TypeScript)
2. **wowid3-server**: Modpack distribution server with admin panel (Rust Axum backend + React frontend)

## Core Technologies

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS 4, Vite 7, Zustand (state management)
- **Backend**: Rust (Tauri 2.x for launcher, Axum 0.7 for modpack server)
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

### Modpack Server (wowid3-server/)

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

# CLI utility for manifest regeneration
cd server && cargo run -- regenerate-manifest <version>
```

The `start.sh` script automatically starts both services and installs dependencies if needed.

## Architecture & Code Structure

### Launcher Architecture (wowid3-launcher/)

**Rust Backend (src-tauri/src/modules/)**:
- `auth.rs`: Microsoft OAuth 2.0 authentication flow for Minecraft (uses PKCE, keyring storage)
- `minecraft.rs`: Minecraft game launcher with platform-specific JVM configuration and GPU handling
- `minecraft_version.rs`: Minecraft version management and metadata
- `game_installer.rs`: Full Minecraft game installation orchestration
- `fabric_installer.rs`: Fabric mod loader installation
- `library_manager.rs`: Minecraft library dependency management
- `asset_manager.rs`: Minecraft asset downloading and management
- `java_runtime.rs`: Bundled Java runtime management (Azul Zulu JVM 21)
- `updater.rs`: Modpack downloading, verification, and updating with hash-based versioning
- `download_manager.rs`: Parallel download orchestration with progress tracking
- `server.rs`: Minecraft server status pinging and player list retrieval
- `discord.rs`: Discord Rich Presence integration
- `audio.rs`: Background music and sound effect management
- `logger.rs`: Structured logging system
- `log_reader.rs`: Minecraft log file parsing and display
- `encrypted_storage.rs`: Encrypted local storage for sensitive data
- `paths.rs`: Cross-platform path management for game directories

**React Frontend (src/)**:
- `App.tsx`: Main application component with navigation
- `components/`: UI components
  - `LauncherHome.tsx`: Main launcher screen with play button, server status, user info
  - `MinecraftSetup.tsx`: Initial Minecraft installation wizard
  - `SettingsScreen.tsx`: User settings and configuration
  - `SkinViewer.tsx`: 3D Minecraft skin viewer using Three.js
  - `CatModel.tsx`: Decorative 3D cat model component
  - `Navigation.tsx`: App navigation bar
  - `ErrorBoundary.tsx`: React error boundary for crash handling
  - `installer/`: Minecraft installation components
    - `InstallProgress.tsx`: Installation progress display
    - `VersionSelector.tsx`: Minecraft version selection
  - `theme/`: Theme-specific components
    - `ChristmasBackground.tsx`: Animated Christmas theme background
  - `ui/`: Reusable UI components (Button, Card, Input, Toast, LoadingSpinner, ProgressBar)
- `hooks/`: Custom React hooks
  - `useAuth.ts`: Microsoft authentication state management
  - `useMinecraftInstaller.ts`: Minecraft installation orchestration
  - `useModpack.ts`: Modpack download and update management with verify/repair
  - `useServer.ts`: Server status polling and player list
  - `useDiscord.ts`: Discord Rich Presence hooks
  - `useAudio.ts`: Background music and audio control
  - `useTauriCommands.ts`: Centralized Tauri command interface
  - `useTheme.ts`: Theme management (Christmas, light, dark themes)
- `stores/`: Zustand state management
  - `authStore.ts`: Authentication state and Microsoft tokens
  - `modpackStore.ts`: Modpack version and installation state
  - `serverStore.ts`: Server status and player count
  - `settingsStore.ts`: User preferences and settings
  - `audioStore.ts`: Audio playback state
  - `uiStore.ts`: UI state (modals, toasts, loading)
- `themes/`: Theme definitions (christmas.json, light.json, dark.json)

**Key Patterns**:
- Tauri commands are defined in Rust and called from React via the `invoke` API
- All async operations use hooks that wrap Tauri commands
- State management uses Zustand for global state
- Credentials are stored securely in system keyring via the `keyring` crate
- Long-running operations use Tauri events for progress updates

### Modpack Server Architecture (wowid3-server/)

The server is a **modpack distribution and release management system**, NOT a Minecraft server manager.

**Rust Backend (server/src/)**:
- `main.rs`: Axum server setup with CORS, routing, and authentication middleware
- `config.rs`: Environment-based configuration loading
- `cli.rs`: CLI commands (manifest regeneration, etc.)
- `api/`: HTTP endpoint handlers
  - `public.rs`: Public API for manifest and file serving (no auth required)
  - `admin.rs`: Admin endpoints for release management (auth required)
  - `drafts.rs`: Draft release management and file browser
- `models/`: Data models
  - `manifest.rs`: Modpack manifest structure with file hashes and changelog
  - `release.rs`: Release version metadata
  - `admin.rs`: Admin authentication models
- `services/`: Business logic
  - `analyzer.rs`: Automatic modpack analysis and version detection
  - `changelog.rs`: Automatic changelog generation from file diffs
- `storage/`: File system operations
  - `files.rs`: File upload, storage, and retrieval
  - `manifest.rs`: Manifest JSON generation and storage
  - `drafts.rs`: Draft management in file system
- `middleware/`: Request middleware
  - `auth.rs`: JWT-based authentication middleware
- `utils.rs`: Utility functions (JAR version extraction, etc.)

**React Admin Panel (web/src/)**:
- `App.tsx`: Main admin dashboard router
- `pages/`: Admin pages
  - `LoginPage.tsx`: Admin authentication
  - `Dashboard.tsx`: Main dashboard with release overview
  - `ReleasesList.tsx`: List of all releases
  - `ReleaseEditor.tsx`: Draft editor with tabbed interface
- `components/`: UI components
  - `FileBrowser.tsx`: File browser with upload and management
  - `tabs/`: Release editor tabs
    - `FilesTab.tsx`: File management and upload
    - `MetadataTab.tsx`: Release metadata editing
    - `ChangelogTab.tsx`: Changelog editing and auto-generation
    - `ReviewTab.tsx`: Pre-publish review
- `hooks/`: API interaction hooks
  - `useAdmin.ts`: Admin operations (login, releases, blacklist)
  - `useDrafts.ts`: Draft management operations
- `stores/`: State management
  - `authStore.ts`: Admin authentication state
  - `releaseStore.ts`: Release and draft state
- `api/client.ts`: Axios client with authentication

**Key Patterns**:
- Backend uses `Arc` for thread-safe shared state
- Supports 20GB file uploads for large modpack files
- Automatic SHA-256 hash calculation for all files
- Manifest versioning with hash-based change detection
- File blacklist system to exclude config files from updates
- Draft system allows preparing releases before publishing

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

The launcher bundles Azul Zulu JVM 21 in `src-tauri/runtime/java/`. This ensures consistent Java versions across systems. The JVM path is hardcoded to use the bundled runtime with platform-specific optimizations:

- **NVIDIA GPUs**: Adds `-Dorg.lwjgl.opengl.Display.enableOSXFullscreenModeAPI=false`
- **AMD GPUs**: Standard LWJGL configuration
- **Intel GPUs**: Standard LWJGL configuration

### Discord Rich Presence

The launcher integrates Discord Rich Presence via the `discord-rich-presence` crate. Status updates show:
- Current game state (in menus, playing)
- Server name and player count
- Session start time
- Custom launcher branding

### Modpack System

Modpacks are defined via a `manifest.json` file containing:
- Modpack version (semantic versioning)
- List of files with URLs and SHA-256 checksums
- Changelog entries with timestamps
- Manifest hash for version comparison

The updater:
1. Fetches manifest from server API
2. Compares installed manifest hash vs. available hash
3. Downloads only changed files (based on SHA-256 comparison)
4. Verifies checksums during and after download
5. Reports progress via Tauri events
6. Supports verify & repair to fix corrupted installations

### Verify & Repair System

Recent addition (commits 806a278, c486f5f) adds integrity verification:
- Compares local file hashes against manifest
- Identifies missing, corrupted, or modified files
- Allows selective or full repair
- Uses manifest hash versioning to detect updates

## Configuration

### Launcher

No `.env` file needed for basic operation. Configuration is handled via:
- System keyring for Microsoft tokens
- Zustand stores for user preferences
- Tauri config for window/app settings
- `settingsStore.ts` for persisted settings (theme, audio volume, etc.)

### Modpack Server

Create `wowid3-server/server/.env` based on environment variables:

```env
ADMIN_PASSWORD=your-secure-password  # Admin login password
STORAGE_PATH=../storage              # Path to file storage
API_PORT=8080                        # API server port
API_HOST=0.0.0.0                     # Bind address
CORS_ORIGIN=http://localhost:5173    # CORS origin (dev mode)
BASE_URL=https://your-domain.com     # Public base URL for file downloads
```

**Important**: Always change `ADMIN_PASSWORD` from the default `changeme`.

## Linux Wayland Support

The launcher requires special environment variables on Wayland to fix WebKit protocol errors:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1      # Fix for NVIDIA GPU users
WEBKIT_DISABLE_COMPOSITING_MODE=1     # Better window stability
GSK_RENDERER=ngl                      # New GL renderer
GDK_BACKEND=wayland,x11               # Fallback to X11 if needed
GDK_DEBUG=gl-prefer-gl                # Prefer GL over GLES
XDG_SESSION_TYPE=wayland              # Explicit session type
```

These are automatically set by:
- `.env.wayland` file (development)
- `wowid3-launcher.sh` wrapper script (production builds)

**Troubleshooting**: If you see "Error 71 (Protocol error) dispatching to Wayland display", ensure these variables are set. See [Tauri Issue #10702](https://github.com/tauri-apps/tauri/issues/10702).

## API Endpoints (Modpack Server)

### Public API (No authentication)

**Manifests**:
- `GET /api/manifest/latest` - Get latest modpack manifest
- `GET /api/manifest/:version` - Get specific version manifest

**Files**:
- `GET /files/:version/*path` - Download modpack file for specific version
- `GET /api/java/:filename` - Download Java runtime binaries
- `GET /api/resources` - List all available resource packs
- `GET /api/resources/:filename` - Download resource pack files

**Health**:
- `GET /health` - Server health check

### Admin API (Requires authentication)

**Authentication**:
- `POST /api/admin/login` - Login with password, returns JWT token

**Release Management**:
- `GET /api/admin/releases` - List all releases
- `POST /api/admin/releases` - Create new release from draft
- `DELETE /api/admin/releases/:version` - Delete a release
- `POST /api/admin/releases/:version/copy-to-draft` - Copy release to draft for editing

**Draft Management**:
- `GET /api/admin/drafts` - List all drafts
- `POST /api/admin/drafts` - Create new draft
- `GET /api/admin/drafts/:id` - Get draft details
- `PUT /api/admin/drafts/:id` - Update draft metadata
- `DELETE /api/admin/drafts/:id` - Delete draft
- `POST /api/admin/drafts/:id/analyze` - Auto-analyze draft files
- `POST /api/admin/drafts/:id/generate-changelog` - Auto-generate changelog
- `POST /api/admin/drafts/:id/publish` - Publish draft as release
- `POST /api/admin/drafts/:id/duplicate` - Duplicate draft

**File Management**:
- `POST /api/admin/upload` - Upload files to uploads directory
- `POST /api/admin/drafts/:id/files` - Add files to draft
- `PUT /api/admin/drafts/:id/files/*path` - Update file in draft
- `DELETE /api/admin/drafts/:id/files/*path` - Remove file from draft

**Resource Pack Management**:
- `POST /api/admin/resources` - Upload resource pack files
- `DELETE /api/admin/resources/:filename` - Delete resource pack

**File Browser** (in-draft editing):
- `GET /api/admin/drafts/:id/browse` - Browse directory
- `GET /api/admin/drafts/:id/read-file` - Read file content
- `POST /api/admin/drafts/:id/write-file` - Write file content
- `POST /api/admin/drafts/:id/create-dir` - Create directory
- `POST /api/admin/drafts/:id/rename` - Rename file/directory
- `POST /api/admin/drafts/:id/move` - Move file/directory

**Blacklist**:
- `GET /api/admin/blacklist` - Get blacklisted file patterns
- `PUT /api/admin/blacklist` - Update blacklist (newline-separated globs)

## Testing

The project uses Rust's built-in testing framework:

```bash
# Run Rust tests in launcher
cd wowid3-launcher/src-tauri && cargo test

# Run Rust tests in modpack server
cd wowid3-server/server && cargo test
```

Test dependencies are defined in `Cargo.toml`:
- `tempfile`: Temporary file/directory creation
- `wiremock`: HTTP mocking (launcher)
- `tokio-test`: Async test utilities (launcher)

## Common Development Patterns

### 1. Adding a new Tauri command (Launcher)
   - Define the Rust function in appropriate `src-tauri/src/modules/*.rs` file
   - Add module to `src-tauri/src/modules/mod.rs` if new
   - Register command in `src-tauri/src/lib.rs` via `.invoke_handler()`
   - Add command signature to `src/hooks/useTauriCommands.ts`
   - Create or update hook in `src/hooks/` to wrap the command
   - Use hook in React components

### 2. Adding a modpack server API endpoint
   - Create handler function in `server/src/api/public.rs` (public) or `server/src/api/admin.rs` (admin)
   - Add route to `server/src/main.rs` router
   - For admin routes, they automatically use auth middleware
   - Update `web/src/api/client.ts` if adding new endpoint
   - Create or update hook in `web/src/hooks/` to call endpoint

### 3. State management
   - **Launcher**: Use Zustand stores in `src/stores/`
   - **Server Backend**: Use `Arc` for shared state
   - **Server Frontend**: Use Zustand stores in `web/src/stores/`
   - Always create index exports for easier imports

### 4. Error handling
   - **Rust**: Use `anyhow::Result<T>` for functions that can fail
   - **Tauri commands**: Return `Result<T, String>` (errors are serialized to strings)
   - **React**: Use `.catch()` on Tauri command promises
   - **Server API**: Use Axum's error handling with proper HTTP status codes

### 5. File operations in modpack server
   - Always use the storage module functions, never raw file I/O
   - Calculate SHA-256 hashes for all uploaded files
   - Respect the blacklist when generating manifests
   - Use glob patterns for blacklist (e.g., `*.txt`, `config/**`)

### 6. Progress reporting
   - Use Tauri events for long-running operations
   - Event names should be descriptive (e.g., `download-progress`, `install-progress`)
   - Include percentage, current step, and total steps in event payload

## Build Artifacts

- **Launcher**: AppImage, deb, NSIS installer in `wowid3-launcher/src-tauri/target/release/bundle/`
- **Server**: Binary at `wowid3-server/server/target/release/wowid3-modpack-server`

## Microsoft OAuth Client ID

The launcher uses the official Minecraft launcher client ID:
`cd1d612b-3203-4622-88d2-4d1f58fb7762`

This is publicly available and used by third-party launchers for Microsoft authentication.

## Recent Features & Changes

Based on recent commits:

1. **Verify & Repair System** (806a278, c486f5f): Full modpack integrity verification with selective repair
2. **Manifest Hash Versioning** (806a278): Hash-based version comparison for faster update detection
3. **Platform-specific GPU Handling** (97cbcea): Automatic GPU detection and JVM flag optimization
4. **CLI Manifest Utility** (271d754): Command-line tool for regenerating manifests without web UI
5. **Enhanced Wayland Support** (65b2d0e): Comprehensive Wayland environment variable setup
6. **Draft System Improvements** (51cc662): Better file handling in draft workflow

## Project-Specific Notes

### Audio Files
The launcher includes two music files in the root:
- `wid3menu.mp3`: Main menu music
- `wid3menu-fallback.mp3`: Fallback menu music

These are loaded by the `audio.rs` module and managed via `audioStore.ts`.

### Theme System
The launcher features a custom theme system with:
- Christmas theme (default): Animated snow background, festive colors
- Light theme: Clean modern interface
- Dark theme: Dark mode with accent colors

Themes are defined in JSON files in `src/themes/` and managed via `useTheme.ts`.

### CAT Model
The launcher includes a 3D cat model (`CatModel.tsx`) as an Easter egg/decorative element, rendered using Three.js.

### Skin Viewer
Uses `skinview3d` library to render 3D Minecraft player skins with animations.

## Development Workflow

### Typical Launcher Development Session
```bash
cd wowid3-launcher
source .env.wayland  # Linux Wayland only
npm run tauri:dev    # Starts both Rust backend and React frontend
```

### Typical Server Development Session
```bash
cd wowid3-server
./start.sh           # Starts both Rust API server and React admin panel
```

### Making a Release
1. Update version in relevant `package.json` and `Cargo.toml`
2. Update changelog documentation
3. Build launcher: `cd wowid3-launcher && npm run tauri build`
4. Build server: `cd wowid3-server/server && cargo build --release`
5. Test builds on target platforms
6. Tag release in git

## Important Conventions

1. **Never commit secrets**: Use environment variables for passwords, tokens, API keys
2. **Test on Wayland**: Always test launcher changes on Wayland (primary target platform)
3. **Hash all files**: Modpack server must calculate SHA-256 for all files
4. **Blacklist user data**: Always exclude save data, configs, screenshots from modpack updates
5. **Semantic versioning**: Use semver for modpack versions (e.g., 1.2.3)
6. **Progress feedback**: Long operations must show progress to user
7. **Error messages**: Provide clear, actionable error messages to users

## Troubleshooting

### Launcher won't start on Linux
- Check Wayland environment variables are set
- Try X11 fallback: `GDK_BACKEND=x11 npm run tauri:dev`
- Check GPU drivers are up to date

### Microsoft auth fails
- Check system time is correct (OAuth requires accurate time)
- Verify keyring is accessible (may require installing `gnome-keyring` on Linux)
- Check internet connection

### Modpack download fails
- Verify server URL is correct in settings
- Check manifest.json is valid JSON
- Verify file URLs are accessible
- Check SHA-256 hashes match

### Server can't start
- Check port 8080 is not in use
- Verify storage directory has write permissions
- Check ADMIN_PASSWORD is set in environment
