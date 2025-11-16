# WOWID3 Launcher Implementation Plan

## Project Overview
Custom Minecraft launcher for WOWID3 modpack with Christmas theme, replacing Modrinth launcher.

**Tech Stack:** Tauri 2.x + Rust + React + TypeScript
**Target Platforms:** Windows (NSIS installer), Linux (AppImage/deb)
**Working Directory:** `/run/media/james/Dongus/wow-is-dead-3/wowid3-launcher/`

## Task 1: Add Wayland Support

**Goal:** Fix display protocol errors preventing launcher from running on Wayland

**Context:**
Current error: `Gdk-Message: Error 71 (Protocol error) dispatching to Wayland display`

**Implementation:**
1. Research Tauri 2.x Wayland support requirements
2. Update `src-tauri/tauri.conf.json` to enable Wayland compatibility
3. Add necessary environment variables or runtime flags
4. Test launcher launches successfully on Wayland
5. Ensure fallback to X11 if Wayland fails

**Success Criteria:**
- Launcher window opens successfully on Wayland
- No protocol errors in console
- Launcher still works on X11 systems

**Files to Modify:**
- `src-tauri/tauri.conf.json`
- Possibly `src-tauri/Cargo.toml` (if additional dependencies needed)

---

## Task 2: Implement Microsoft OAuth Flow

**Goal:** Complete authentication flow for Minecraft accounts

**Context:**
Stubbed in `src-tauri/src/modules/auth.rs` with `todo!()` macros

**Implementation:**
1. Implement OAuth 2.0 flow:
   - Start local HTTP server on port 23947 for callback
   - Open browser to Microsoft OAuth URL with client ID
   - Receive authorization code from callback
   - Exchange code for Microsoft access token
2. Chain authentication:
   - Microsoft token → Xbox Live token
   - Xbox Live → XSTS token
   - XSTS → Minecraft access token
3. Fetch player profile:
   - Username, UUID, skin URL
4. Store credentials securely in OS keyring
5. Implement token refresh logic
6. Write tests for auth flow

**Success Criteria:**
- User can click "Login" and complete OAuth in browser
- Credentials stored securely in OS keyring
- Profile info (username, UUID) displayed in UI
- Tokens automatically refresh before expiry
- Logout clears stored credentials

**Files to Modify:**
- `src-tauri/src/modules/auth.rs`

**Testing:**
- Unit tests for token exchange
- Integration test for full auth flow
- Test credential storage/retrieval

---

## Task 3: Implement Modpack Downloading/Updating

**Goal:** Download and verify modpack files with delta updates

**Context:**
Stubbed in `src-tauri/src/modules/updater.rs`

**Implementation:**
1. Fetch manifest from configured URL:
   - Parse JSON manifest with version, files list, checksums
2. Compare local vs remote:
   - Read `.wowid3-version` file for installed version
   - Determine which files need downloading
3. Download files with verification:
   - SHA256 checksum validation
   - Retry logic for failed downloads
   - Progress reporting to frontend
4. First-time installation:
   - Download all files
   - Create directory structure
   - Write version file
5. Update existing installation:
   - Download only changed files
   - Clean up removed files
   - Update version file
6. Error handling:
   - Network failures
   - Checksum mismatches
   - Disk space issues

**Success Criteria:**
- First installation downloads all files correctly
- Updates download only changed files
- SHA256 verification catches corrupted downloads
- Progress bar shows accurate download status
- Version info displays in UI
- Update badge appears when new version available

**Files to Modify:**
- `src-tauri/src/modules/updater.rs`

**Testing:**
- Mock HTTP server for manifest and files
- Test checksum verification (valid and invalid)
- Test delta update logic
- Test progress reporting

---

## Task 4: Implement Minecraft Server Pinging

**Goal:** Check server status and player count

**Context:**
Stubbed in `src-tauri/src/modules/server.rs`

**Implementation:**
1. Implement Minecraft Server List Ping protocol:
   - Open TCP connection to server address
   - Send handshake packet
   - Send status request packet
   - Parse JSON response
2. Extract server info:
   - Online/offline status
   - Player count and max players
   - Player list (if available)
   - Server version
   - MOTD (Message of the Day)
3. Background polling:
   - Poll every 30 seconds (configurable)
   - Update frontend state on changes
   - Handle server timeouts gracefully
4. Error handling:
   - Connection timeouts
   - Invalid responses
   - Server offline

**Success Criteria:**
- Server status indicator shows online/offline
- Player count updates every 30 seconds
- MOTD displays in UI
- Offline servers don't crash launcher
- Polling can be started/stopped

**Files to Modify:**
- `src-tauri/src/modules/server.rs`

**Testing:**
- Mock server for testing protocol
- Test online/offline detection
- Test polling interval
- Test timeout handling

---

## Task 5: Implement Minecraft Game Launching

**Goal:** Launch Minecraft with correct arguments and monitor process

**Context:**
Stubbed in `src-tauri/src/modules/minecraft.rs`

**Implementation:**
1. Build Java command:
   - Use bundled JVM path (or fallback to system Java)
   - Memory arguments: `-Xmx{ram}M -Xms{ram}M`
   - Minecraft-specific JVM flags
   - Classpath with all mod JARs and Minecraft client
   - Main class: typically Fabric launcher
2. Construct game arguments:
   - Username, UUID, access token
   - Game directory
   - Assets directory
   - Version info
   - Server address (for auto-connect)
3. Set working directory and environment
4. Launch process:
   - Spawn child process
   - Capture stdout/stderr for log viewer
   - Monitor process status
5. Crash detection:
   - Parse crash reports
   - Display user-friendly error messages
   - Log analysis for common issues

**Success Criteria:**
- Game launches successfully with correct credentials
- RAM allocation settings applied
- Game logs stream to frontend (if log viewer implemented)
- Crashes detected and reported
- Launcher can minimize/close after game starts

**Files to Modify:**
- `src-tauri/src/modules/minecraft.rs`

**Testing:**
- Test command construction
- Test with different RAM settings
- Test with bundled vs system Java
- Mock game process for testing

---

## Task 6: Implement Discord Rich Presence

**Goal:** Display "Playing WOWID3" status in Discord

**Context:**
`discord-rich-presence` crate already added to dependencies

**Implementation:**
1. Register Discord application:
   - Create Discord app at developer portal
   - Get application ID
2. Initialize Discord RPC client:
   - Connect to Discord client
   - Handle connection failures gracefully
3. Set presence when game launches:
   - State: "Playing WOWID3 Modpack"
   - Details: Server name and player count
   - Large image: WOWID3 logo
   - Start timestamp
4. Update presence:
   - Refresh server info periodically
   - Clear presence when game closes
5. Handle Discord not running:
   - Don't crash if Discord unavailable
   - Retry connection periodically

**Success Criteria:**
- Rich presence appears in Discord when game running
- Shows server info and player count
- Clears when game closes
- Launcher doesn't fail if Discord unavailable

**Files to Modify:**
- `src-tauri/src/modules/discord.rs` (create new file)
- `src-tauri/src/modules/mod.rs` (add discord module)
- `src-tauri/src/lib.rs` (integrate with game launch)

**Testing:**
- Test with Discord running
- Test with Discord not running
- Test presence updates
- Test cleanup on game exit

---

## Task 7: Bundle Azul Zulu JVM 21

**Goal:** Include self-contained JVM in launcher installers

**Context:**
User requirement: "make it fully self contained with no additional setup"
User specified: "use zulu 21 jvm, faster, more reliable"

**Implementation:**
1. Download Azul Zulu JVM 21:
   - Linux x64: https://www.azul.com/downloads/?package=jdk#zulu
   - Windows x64: Same source
2. Extract JVM to `src-tauri/runtime/java/`:
   - Directory structure: `runtime/java/bin/java`, `runtime/java/lib/`, etc.
3. Configure Tauri bundler:
   - Update `tauri.conf.json` to include `runtime/` in bundle
   - Ensure permissions preserved (Linux)
4. Update `get_bundled_java_path()`:
   - Return correct path for bundled JVM
   - Test on both Windows and Linux
5. Add to `.gitignore`:
   - Don't commit JVM binaries to git
   - Document download/setup in README

**Success Criteria:**
- NSIS installer includes JVM for Windows
- AppImage/deb includes JVM for Linux
- Launcher uses bundled JVM by default
- No system Java required
- Installers work on clean systems

**Files to Modify:**
- `src-tauri/tauri.conf.json`
- `src-tauri/src/modules/minecraft.rs` (verify bundled path)
- `.gitignore`
- `README.md` (document JVM setup)

**Testing:**
- Build installer and verify JVM included
- Test on system without Java installed
- Verify correct Java version used

---

## General Guidelines

**For All Tasks:**
1. Follow TDD where applicable
2. Write tests before implementation
3. Ensure all tests pass
4. Update documentation
5. Commit work with clear messages
6. Report what was implemented, tested, and any issues

**Code Quality:**
- Handle errors with `Result<T, Error>` types
- Use `anyhow` for error context
- Log important events
- Add doc comments for public functions
- Follow Rust best practices

**Testing:**
- Unit tests for individual functions
- Integration tests for full workflows
- Mock external dependencies
- Test error cases

**Frontend Integration:**
- Ensure Tauri commands work with existing React hooks
- Update UI to show new functionality
- Handle loading/error states
- Test with actual UI interactions
