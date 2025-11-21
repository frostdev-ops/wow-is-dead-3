# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

WOWID3 is a comprehensive Minecraft modpack distribution system consisting of three main components:

1.  **wowid3-launcher**: A custom launcher built with Tauri (Rust) and React.
2.  **wowid3-server**: A backend server (Rust/Axum) and admin panel (React) for managing modpack releases.
3.  **wowid3-tracker-mod**: A Fabric mod (Java) that collects player statistics and integrates with the server.

## Development Commands

### Launcher (`wowid3-launcher/`)

*   **Run in Development Mode**:
    ```bash
    npm run tauri:dev
    ```
    *   **Linux Wayland Users**: Use `.env.wayland` to avoid protocol errors:
        ```bash
        source .env.wayland && npm run tauri:dev
        # OR
        npm run tauri:dev:wayland
        ```

*   **Build for Production**:
    ```bash
    npm run tauri build
    ```

*   **Run Tests**:
    ```bash
    # Rust Backend Tests
    cd src-tauri && cargo test
    ```

### Modpack Server (`wowid3-server/`)

*   **Start All Services** (Recommended):
    ```bash
    ./start.sh
    ```

*   **Backend Development**:
    ```bash
    cd server && cargo run
    ```
    *   *Note*: Requires environment variables (see `server/.env`).

*   **Frontend Development**:
    ```bash
    cd web && npm run dev
    ```

*   **Build for Production**:
    ```bash
    # Backend
    cd server && cargo build --release
    
    # Frontend
    cd web && npm run build
    ```

*   **CLI Tools** (Manifest Regeneration):
    ```bash
    cd server && cargo run -- regenerate-manifest <version>
    ```

### Tracker Mod (`wowid3-tracker-mod/`)

*   **Build Mod**:
    ```bash
    ./gradlew build
    ```

## Architecture & Structure

### Launcher (`wowid3-launcher`)
*   **Backend (`src-tauri/src/modules/`)**:
    *   `auth.rs`: Microsoft OAuth 2.0 flow with PKCE.
    *   `minecraft.rs` & `game_installer.rs`: Game launch and installation logic.
    *   `updater.rs`: Modpack verification and updates (hash-based).
*   **Frontend (`src/`)**:
    *   `hooks/`: Custom hooks wrapping Tauri commands (e.g., `useAuth`, `useModpack`).
    *   `stores/`: Zustand stores for global state (`authStore`, `serverStore`).

### Modpack Server (`wowid3-server`)
*   **Backend (`server/src/`)**:
    *   **API**: `api/` contains endpoints for public access, admin management, and the tracker.
    *   **Storage**: `storage/` handles file uploads and manifest generation.
    *   **Database**: SQLite database for player statistics.
*   **Frontend (`web/src/`)**:
    *   Admin dashboard for creating drafts, uploading files, and publishing releases.

### Tracker Mod (`wowid3-tracker-mod`)
*   Fabric mod that hooks into Minecraft events.
*   Sends player data and chat to the `wowid3-server` via the Tracker API.

## Common Conventions

*   **Wayland Support**: The launcher requires specific environment variables (like `WEBKIT_DISABLE_DMABUF_RENDERER=1`) to run correctly on Wayland. These are handled in `.env.wayland`.
*   **Versioning**: Modpacks use semantic versioning. Updates are detected via manifest hash comparison.
*   **Security**:
    *   Launcher: Microsoft tokens are stored in the system keyring.
    *   Server: `TRACKER_SECRET` is required for mod-to-server communication.
