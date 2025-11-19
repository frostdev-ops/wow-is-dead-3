# Launcher Self-Update System - Implementation Summary

## Overview
Successfully implemented a mandatory self-update mechanism for the Windows launcher that polls the modpack server for updates, downloads new versions, and performs in-place executable replacement with automatic restart.

## Status: ✅ COMPLETE

All components have been implemented and tested for compilation:
- ✅ Server Backend (Rust) - No errors
- ✅ Server Frontend (React/TypeScript) - No errors  
- ✅ Launcher Backend (Rust) - 6 warnings (pre-existing, unrelated to updater)
- ✅ Launcher Frontend (React/TypeScript) - No errors

---

## Implementation Details

### 1. Server-Side (wowid3-server)

#### Backend Files Modified/Created:
- **`server/src/models/manifest.rs`** - Added `LauncherManifest` struct
- **`server/src/config.rs`** - Added `launcher_path()` and `launcher_manifest_path()` methods
- **`server/src/storage/launcher.rs`** - NEW: Launcher manifest read/write operations
- **`server/src/storage/mod.rs`** - Fixed type signatures and added launcher module export
- **`server/src/api/public.rs`** - Added public endpoints:
  - `GET /api/launcher/latest` - Returns launcher update manifest
  - `GET /files/launcher/:filename` - Serves launcher executable
- **`server/src/api/admin.rs`** - Added admin endpoint:
  - `POST /api/admin/launcher` - Upload new launcher version
- **`server/src/main.rs`** - Added launcher directory initialization and route registration

#### Storage Structure:
```
storage/
  launcher/
    WOWID3Launcher.exe  # Latest launcher binary
    latest.json          # Launcher manifest
```

#### Launcher Manifest Format:
```json
{
  "version": "1.1.0",
  "url": "https://wowid-launcher.frostdev.io/files/launcher/WOWID3Launcher.exe",
  "sha256": "abc123...",
  "size": 52428800,
  "changelog": "Bug fixes and improvements",
  "mandatory": true
}
```

#### Frontend Files Created:
- **`web/src/pages/LauncherPage.tsx`** - NEW: Admin UI for uploading launcher updates
- **`web/src/App.tsx`** - Added `/launcher` route
- **`web/src/components/Sidebar.tsx`** - Added "Launcher" navigation item (Rocket icon)
- **`web/src/components/Layout.tsx`** - Added "Launcher Updates" title mapping

### 2. Client-Side (wowid3-launcher)

#### Backend Files Created/Modified:
- **`src-tauri/src/modules/launcher_updater.rs`** - NEW: Self-update logic
  - `check_launcher_update()` - Polls server for updates, compares versions
  - `install_launcher_update()` - Downloads, verifies, replaces exe, restarts
  - `is_newer_version()` - Semantic version comparison
- **`src-tauri/src/modules/mod.rs`** - Added `launcher_updater` module
- **`src-tauri/src/lib.rs`** - Registered Tauri commands:
  - `cmd_check_launcher_update`
  - `cmd_install_launcher_update`
- **`src-tauri/Cargo.toml`** - Added dependencies:
  - `uuid = { version = "1.4", features = ["v4"] }`
  - `tokio-stream = "0.1"`

#### Frontend Files Created/Modified:
- **`src/components/LauncherUpdateModal.tsx`** - NEW: Mandatory update modal
  - Displays version, changelog, mandatory warning
  - Download progress bar
  - Auto-restart on completion
  - Cannot be dismissed if mandatory
- **`src/hooks/useTauriCommands.ts`** - Added:
  - `LauncherUpdateInfo` interface
  - `checkLauncherUpdate()` function
  - `installLauncherUpdate()` function
- **`src/App.tsx`** - Added:
  - Update check on startup
  - Modal rendering when update available
- **`src/components/ui/index.ts`** - NEW: Component exports
- **`src/components/ui/ProgressBar.tsx`** - Added `className` prop support

---

## Update Flow

### Admin Workflow:
1. Build launcher: `cd wowid3-launcher && npm run tauri build`
2. Navigate to Admin Panel → Launcher
3. Upload `WOWID3Launcher.exe`
4. Enter version (e.g., `1.1.0`) and changelog
5. Click "Release Update"

### User Workflow:
1. User opens launcher (any version < latest)
2. Launcher checks server: `GET /api/launcher/latest`
3. If newer version found → Modal appears (cannot be dismissed)
4. User clicks "Update & Restart"
5. Download progress displayed
6. On completion:
   - Current exe renamed to `WOWID3Launcher.exe.old`
   - New exe moved to `WOWID3Launcher.exe`
   - New process spawned
   - Old process exits
7. Launcher restarts with new version

---

## Technical Details

### Windows Self-Replace Logic:
```rust
// 1. Download to temp file
let temp_exe = exe_dir.join("update_{uuid}.exe");

// 2. Verify SHA256 hash
verify_checksum(temp_exe, expected_sha256);

// 3. Rename current exe
fs::rename("WOWID3Launcher.exe", "WOWID3Launcher.exe.old");

// 4. Move new exe to current location
fs::rename(temp_exe, "WOWID3Launcher.exe");

// 5. Spawn new process and exit
Command::new("WOWID3Launcher.exe").spawn();
std::process::exit(0);
```

### Version Comparison:
Uses semantic versioning comparison:
- Splits versions by `.` (e.g., `1.10.2` → `[1, 10, 2]`)
- Compares component by component
- Handles varying lengths (e.g., `1.0` vs `1.0.1`)

### Security:
- SHA256 verification before applying update
- Rollback on failure (reverts `.old` → `.exe`)
- Server-side: Only allows `WOWID3Launcher.exe` filename
- Path traversal protection

---

## API Reference

### Public Endpoints:
```
GET /api/launcher/latest
Response: LauncherManifest

GET /files/launcher/WOWID3Launcher.exe
Response: Binary stream (application/vnd.microsoft.portable-executable)
```

### Admin Endpoints (Requires JWT):
```
POST /api/admin/launcher
Content-Type: multipart/form-data
Fields:
  - file: WOWID3Launcher.exe
  - version: "1.1.0"
  - changelog: "Bug fixes..."
  - mandatory: "true"
Response: { message, version, mandatory }
```

---

## Files Changed Summary

### Server (wowid3-server):
- ✅ 8 files modified
- ✅ 1 file created (launcher.rs)
- ✅ 0 compilation errors
- ✅ Storage directory initialization added

### Launcher (wowid3-launcher):
- ✅ 7 files modified
- ✅ 2 files created (launcher_updater.rs, LauncherUpdateModal.tsx, ui/index.ts)
- ✅ 2 dependencies added (uuid, tokio-stream)
- ✅ 0 compilation errors
- ⚠️ 6 warnings (pre-existing, unrelated to updater)

---

## Testing Checklist

### Server Testing:
- [ ] Start server: `cd wowid3-server && ./start.sh`
- [ ] Verify launcher directory exists: `ls storage/launcher/`
- [ ] Upload a test launcher via Admin Panel
- [ ] Verify `storage/launcher/WOWID3Launcher.exe` exists
- [ ] Verify `storage/launcher/latest.json` exists
- [ ] Test public endpoint: `curl http://localhost:8080/api/launcher/latest`

### Launcher Testing (Windows):
- [ ] Build launcher: `npm run tauri build`
- [ ] Set launcher version to `0.1.0` in `tauri.conf.json`
- [ ] Upload version `0.2.0` to server
- [ ] Run launcher → Update modal should appear
- [ ] Click "Update & Restart" → Should download and restart
- [ ] Verify new version running
- [ ] Check `.exe.old` file exists as backup

---

## Known Limitations

1. **Windows Only**: Self-update only works on Windows (by design per requirements)
2. **No Delta Updates**: Downloads entire exe (not incremental patches)
3. **Single File**: Only supports single `.exe` file (no multi-file installers)
4. **No Version History**: Server only stores latest version
5. **No Rollback UI**: Users cannot rollback to previous versions via UI

---

## Future Enhancements

1. Add version history to server (store multiple launcher versions)
2. Implement delta/patch updates for faster downloads
3. Add Linux AppImage self-update support
4. Add macOS DMG self-update support
5. Add rollback capability in UI
6. Add automatic backup of previous N versions
7. Add release notes preview in admin panel before upload

---

## Maintenance Notes

### Updating the Launcher:
1. Increment version in `wowid3-launcher/src-tauri/tauri.conf.json`
2. Build for Windows target
3. Upload via Admin Panel
4. Users will be prompted on next launch

### Server Configuration:
- Ensure `BASE_URL` in `.env` points to public server URL
- Launcher binary can be large (50-100MB) - ensure sufficient storage
- No special configuration needed for launcher updates

### Debugging:
- Check server logs: `journalctl -u wowid3-server -f`
- Check launcher logs: Console output shows `[Updater]` prefix
- Verify manifest exists: `cat storage/launcher/latest.json`
- Test connectivity: `curl https://wowid-launcher.frostdev.io/api/launcher/latest`

