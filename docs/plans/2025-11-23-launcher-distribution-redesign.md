# Launcher Distribution & Update System Redesign

**Date:** 2025-11-23
**Status:** Approved
**Author:** Claude Code (with James Kueller)

## Problem Statement

The current launcher distribution system has a fundamental flaw: the public download page and auto-update mechanism use the same endpoint, serving only the launcher executable (.exe or AppImage). This means:

1. First-time users don't get proper installers (NSIS on Windows, .deb on Linux)
2. Users must manually create shortcuts, Start Menu entries, and system integration
3. No clean uninstall process for users
4. Professional distribution requires proper installer packages

## Solution Overview

Implement explicit, purpose-driven API endpoints that separate installer distribution (for first-time users) from executable distribution (for auto-updates), with intelligent platform detection and backward compatibility.

## Design Decisions

### Decision 1: Endpoint Architecture
**Chosen:** Explicit versioned endpoints
**Rationale:** Clear separation of concerns, explicit control over file types

### Decision 2: Platform Detection
**Chosen:** Hybrid approach (auto-detect + explicit parameters)
**Rationale:** Best user experience with fallback options for manual selection

### Decision 3: Linux Format
**Chosen:** AppImage only
**Rationale:** Universal compatibility, self-contained, existing auto-update support

### Decision 4: Backward Compatibility
**Chosen:** Migrate old endpoint with redirect
**Rationale:** Cleaner architecture, existing launchers continue working via 308 redirect

## API Endpoint Architecture

### Public Endpoints (no authentication required)

1. **`GET /api/launcher/latest/installer`**
   - Auto-detects platform from User-Agent header
   - Returns installer file (NSIS for Windows, AppImage for Linux)
   - Returns 300 Multiple Choices if detection fails
   - Used by download page primary button

2. **`GET /api/launcher/latest/installer/{platform}`**
   - Explicit platform: `windows`, `linux`, `macos`
   - Returns appropriate installer file
   - Used by download page manual platform buttons

3. **`GET /api/launcher/latest/executable`**
   - Auto-detects platform from User-Agent
   - Returns executable for auto-updates
   - Used by launcher's update mechanism

4. **`GET /api/launcher/latest/executable/{platform}`**
   - Explicit platform executable download
   - Used by launcher with explicit platform override

5. **`GET /api/launcher/latest`** (backward compatibility)
   - Returns 308 Permanent Redirect to `/api/launcher/latest/executable`
   - Preserves existing launcher functionality
   - Allows gradual migration

### File Type Mapping

| Platform | Installer | Executable | Notes |
|----------|-----------|------------|-------|
| Windows  | NSIS `.exe` (e.g., `WOWID3Launcher-Setup-1.2.0.exe`) | Launcher `.exe` (e.g., `WOWID3Launcher.exe`) | Different files |
| Linux    | AppImage (e.g., `WOWID3Launcher-1.2.0.AppImage`) | Same AppImage | Reused for consistency |
| macOS    | `.dmg` (future) | `.app` bundle (future) | Not implemented yet |

## Data Model Changes

### Enhanced Manifest Structure

```rust
pub struct LauncherVersion {
    pub version: String,
    pub files: Vec<LauncherFile>,
    pub changelog: String,
    pub mandatory: bool,
    pub released_at: String,
}

pub struct LauncherFile {
    pub platform: String,        // "windows", "linux", "macos"
    pub file_type: String,       // NEW: "installer" or "executable"
    pub filename: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
}
```

### Example Manifest

```json
{
  "version": "1.2.0",
  "files": [
    {
      "platform": "windows",
      "file_type": "installer",
      "filename": "WOWID3Launcher-Setup-1.2.0.exe",
      "url": "https://wowid-launcher.frostdev.io/files/launcher/1.2.0/WOWID3Launcher-Setup-1.2.0.exe",
      "sha256": "abc123...",
      "size": 45829120
    },
    {
      "platform": "windows",
      "file_type": "executable",
      "filename": "WOWID3Launcher.exe",
      "url": "https://wowid-launcher.frostdev.io/files/launcher/1.2.0/WOWID3Launcher.exe",
      "sha256": "def456...",
      "size": 42991616
    },
    {
      "platform": "linux",
      "file_type": "installer",
      "filename": "WOWID3Launcher-1.2.0.AppImage",
      "url": "https://wowid-launcher.frostdev.io/files/launcher/1.2.0/WOWID3Launcher-1.2.0.AppImage",
      "sha256": "ghi789...",
      "size": 89478485
    },
    {
      "platform": "linux",
      "file_type": "executable",
      "filename": "WOWID3Launcher-1.2.0.AppImage",
      "url": "https://wowid-launcher.frostdev.io/files/launcher/1.2.0/WOWID3Launcher-1.2.0.AppImage",
      "sha256": "ghi789...",
      "size": 89478485
    }
  ],
  "changelog": "- Feature: Added VPN integration\n- Fix: Resolved stats page layout",
  "mandatory": false,
  "released_at": "2025-11-23T04:30:00Z"
}
```

**Note:** For Linux, installer and executable are the same AppImage file (identical SHA256), listed separately for API consistency.

## Server-Side Implementation

### Platform Detection Logic

Priority order for User-Agent parsing:

1. **Windows:** User-Agent contains "Windows" → serve Windows files
2. **Linux:** User-Agent contains "Linux" or "X11" → serve Linux files
3. **macOS:** User-Agent contains "Macintosh" or "Mac OS" → serve macOS files
4. **Unknown:** Return HTTP 300 Multiple Choices with JSON list of available platforms

### API Handler Implementation (in `api/public.rs`)

```rust
// GET /api/launcher/latest/installer
pub async fn get_launcher_installer(
    headers: HeaderMap,
    State(state): State<PublicState>
) -> Result<Response, AppError> {
    let platform = detect_platform_from_headers(&headers);

    if platform.is_none() {
        return Ok(multiple_choices_response(&state).await);
    }

    serve_launcher_file(&state, platform.unwrap(), "installer").await
}

// GET /api/launcher/latest/installer/{platform}
pub async fn get_launcher_installer_platform(
    Path(platform): Path<String>,
    State(state): State<PublicState>
) -> Result<Response, AppError> {
    serve_launcher_file(&state, &platform, "installer").await
}

// GET /api/launcher/latest/executable
pub async fn get_launcher_executable(
    headers: HeaderMap,
    State(state): State<PublicState>
) -> Result<Response, AppError> {
    let platform = detect_platform_from_headers(&headers);

    if platform.is_none() {
        return Ok(multiple_choices_response(&state).await);
    }

    serve_launcher_file(&state, platform.unwrap(), "executable").await
}

// GET /api/launcher/latest/executable/{platform}
pub async fn get_launcher_executable_platform(
    Path(platform): Path<String>,
    State(state): State<PublicState>
) -> Result<Response, AppError> {
    serve_launcher_file(&state, &platform, "executable").await
}

// GET /api/launcher/latest (backward compatibility)
pub async fn get_latest_launcher_redirect() -> Redirect {
    Redirect::permanent("/api/launcher/latest/executable")
}

// Helper: Serve launcher file
async fn serve_launcher_file(
    state: &PublicState,
    platform: &str,
    file_type: &str
) -> Result<Response, AppError> {
    // 1. Load latest version from index
    let index = storage::launcher::load_launcher_versions_index(&state.config).await?;
    let version = storage::launcher::load_launcher_version(&state.config, &index.latest).await?;

    // 2. Find matching file
    let file = version.files.iter()
        .find(|f| f.platform == platform && f.file_type == file_type)
        .ok_or_else(|| AppError::NotFound(format!("No {} for {}", file_type, platform)))?;

    // 3. Stream file from storage
    let file_path = state.config.launcher_file_path(&version.version, &file.filename);
    let file_stream = fs::File::open(&file_path).await?;

    let headers = [
        (header::CONTENT_TYPE, "application/octet-stream"),
        (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", file.filename).as_str()),
        (header::CONTENT_LENGTH, file.size.to_string().as_str()),
    ];

    Ok((headers, ReaderStream::new(file_stream)).into_response())
}

// Helper: Platform detection
fn detect_platform_from_headers(headers: &HeaderMap) -> Option<String> {
    let user_agent = headers.get(header::USER_AGENT)?
        .to_str().ok()?;

    if user_agent.contains("Windows") {
        Some("windows".to_string())
    } else if user_agent.contains("Linux") || user_agent.contains("X11") {
        Some("linux".to_string())
    } else if user_agent.contains("Macintosh") || user_agent.contains("Mac OS") {
        Some("macos".to_string())
    } else {
        None
    }
}

// Helper: Multiple choices response
async fn multiple_choices_response(state: &PublicState) -> Response {
    let index = storage::launcher::load_launcher_versions_index(&state.config).await.ok()?;
    let version = storage::launcher::load_launcher_version(&state.config, &index.latest).await.ok()?;

    let platforms: Vec<String> = version.files.iter()
        .filter(|f| f.file_type == "installer")
        .map(|f| f.platform.clone())
        .collect();

    (
        StatusCode::MULTIPLE_CHOICES,
        Json(json!({
            "message": "Multiple platforms available",
            "platforms": platforms,
            "endpoints": platforms.iter().map(|p|
                format!("/api/launcher/latest/installer/{}", p)
            ).collect::<Vec<_>>()
        }))
    ).into_response()
}
```

### Error Handling

| Status Code | Condition |
|-------------|-----------|
| 200 OK | File found and served |
| 300 Multiple Choices | Platform auto-detection failed, return platform list |
| 308 Permanent Redirect | Old endpoint → new endpoint |
| 404 Not Found | Version/platform/file_type not found |
| 500 Internal Server Error | Storage/IO errors |

## Launcher-Side Updates

### Changes to `launcher_updater.rs`

**Update Manifest URL (line 12):**

```rust
// Old:
const LAUNCHER_MANIFEST_URL: &str = "https://wowid-launcher.frostdev.io/api/launcher/latest";

// New (recommended):
const LAUNCHER_MANIFEST_URL: &str = "https://wowid-launcher.frostdev.io/api/launcher/latest/executable";
```

**File Selection Logic (lines 106-109):**

```rust
// Find file for current platform with file_type = "executable"
let platform_file = launcher_version.files.iter()
    .find(|f| f.platform == current_platform &&
              f.file_type.as_deref() == Some("executable"))
    .context(format!("No executable found for platform: {}", current_platform))?;
```

**Backward Compatibility:**

Make `file_type` optional for old manifests:

```rust
// Accept both new manifests (with file_type) and old manifests (without)
let platform_file = launcher_version.files.iter()
    .find(|f| f.platform == current_platform &&
              (f.file_type.as_deref() == Some("executable") || f.file_type.is_none()))
    .context(format!("No executable found for platform: {}", current_platform))?;
```

### No Breaking Changes

- Old launchers (using `/api/launcher/latest`) work via 308 redirect
- New launchers explicitly request `/executable` endpoint
- Gradual migration without forced updates

## Admin Panel & Upload Workflow

### Admin API Endpoint (in `api/admin.rs`)

```rust
/// POST /api/admin/launcher/releases
pub async fn create_launcher_release(
    headers: HeaderMap,
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> Result<Json<LauncherVersion>, AppError> {
    // Verify admin authentication
    verify_admin_token(&headers, &state.config)?;

    let mut version = String::new();
    let mut changelog = String::new();
    let mut mandatory = false;
    let mut files: Vec<(String, String, Vec<u8>)> = vec![]; // (platform, file_type, bytes)

    // Parse multipart form
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "version" => version = field.text().await?,
            "changelog" => changelog = field.text().await?,
            "mandatory" => mandatory = field.text().await? == "true",
            "windows_installer" => {
                let bytes = field.bytes().await?.to_vec();
                files.push(("windows".to_string(), "installer".to_string(), bytes));
            },
            "windows_executable" => {
                let bytes = field.bytes().await?.to_vec();
                files.push(("windows".to_string(), "executable".to_string(), bytes));
            },
            "linux_appimage" => {
                let bytes = field.bytes().await?.to_vec();
                // Add same file for both installer and executable
                files.push(("linux".to_string(), "installer".to_string(), bytes.clone()));
                files.push(("linux".to_string(), "executable".to_string(), bytes));
            },
            _ => {}
        }
    }

    // Validate version
    if version.is_empty() {
        return Err(AppError::BadRequest("Version is required".to_string()));
    }

    // Create version directory
    let version_dir = state.config.launcher_version_path(&version);
    fs::create_dir_all(&version_dir).await?;

    // Process and save files
    let mut launcher_files = Vec::new();

    for (platform, file_type, bytes) in files {
        // Generate filename
        let filename = match (platform.as_str(), file_type.as_str()) {
            ("windows", "installer") => format!("WOWID3Launcher-Setup-{}.exe", version),
            ("windows", "executable") => "WOWID3Launcher.exe".to_string(),
            ("linux", _) => format!("WOWID3Launcher-{}.AppImage", version),
            _ => continue,
        };

        // Calculate SHA256
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let sha256 = format!("{:x}", hasher.finalize());

        // Save file
        let file_path = version_dir.join(&filename);
        fs::write(&file_path, &bytes).await?;

        // Generate URL
        let url = format!(
            "{}/files/launcher/{}/{}",
            state.config.base_url, version, filename
        );

        launcher_files.push(LauncherFile {
            platform: platform.clone(),
            file_type: file_type.clone(),
            filename,
            url,
            sha256,
            size: bytes.len() as u64,
        });
    }

    // Create LauncherVersion
    let launcher_version = LauncherVersion {
        version: version.clone(),
        files: launcher_files,
        changelog,
        mandatory,
        released_at: chrono::Utc::now().to_rfc3339(),
    };

    // Save version manifest
    storage::launcher::save_launcher_version(&state.config, &launcher_version).await?;

    Ok(Json(launcher_version))
}
```

### Admin Panel UI Component

**New File:** `wowid3-server/web/src/pages/LauncherReleaseEditor.tsx`

```typescript
interface LauncherReleaseForm {
  version: string;
  changelog: string;
  mandatory: boolean;
  windowsInstaller: File | null;
  windowsExecutable: File | null;
  linuxAppImage: File | null;
}

export function LauncherReleaseEditor() {
  const [form, setForm] = useState<LauncherReleaseForm>({
    version: '',
    changelog: '',
    mandatory: false,
    windowsInstaller: null,
    windowsExecutable: null,
    linuxAppImage: null,
  });

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append('version', form.version);
    formData.append('changelog', form.changelog);
    formData.append('mandatory', form.mandatory.toString());

    if (form.windowsInstaller) {
      formData.append('windows_installer', form.windowsInstaller);
    }
    if (form.windowsExecutable) {
      formData.append('windows_executable', form.windowsExecutable);
    }
    if (form.linuxAppImage) {
      formData.append('linux_appimage', form.linuxAppImage);
    }

    await api.post('/admin/launcher/releases', formData);
  };

  // UI with file upload fields, version input, changelog textarea, etc.
}
```

**Update Admin Dashboard Navigation:**

Add "Launcher Releases" link to main dashboard menu.

### Storage Structure

```
storage/launcher/
├── versions.json              # Index with version list and latest
├── 1.2.0/
│   ├── manifest.json          # LauncherVersion manifest
│   ├── WOWID3Launcher-Setup-1.2.0.exe
│   ├── WOWID3Launcher.exe
│   └── WOWID3Launcher-1.2.0.AppImage
├── 1.1.9/
│   └── ...
└── 1.1.8/
    └── ...
```

## Migration Strategy & Deployment

### Phase 1: Backend Changes (Non-Breaking)

**Tasks:**
1. Add `file_type: Option<String>` field to `LauncherFile` struct
2. Implement new API endpoints in `api/public.rs`:
   - `/installer` and `/installer/{platform}`
   - `/executable` and `/executable/{platform}`
   - Platform detection helper
   - File serving helper
3. Add 308 redirect from `/api/launcher/latest` → `/api/launcher/latest/executable`
4. Update routing in `main.rs`
5. Test endpoints with curl
6. Deploy server changes

**Verification:**
- Existing launchers continue working via redirect
- New endpoints return correct files
- Platform detection works for common User-Agents

### Phase 2: Admin Panel Updates

**Tasks:**
1. Create `LauncherReleaseEditor.tsx` component
2. Add admin API endpoint `POST /admin/launcher/releases`
3. Update admin dashboard navigation
4. Implement multi-file upload with progress bars
5. Add client-side SHA256 calculation for verification
6. Deploy admin panel updates

**Verification:**
- Can upload multiple files in single form
- SHA256 calculated correctly
- Files saved to correct storage paths
- Manifest generated and index updated

### Phase 3: Initial Release Upload

**Tasks:**
1. Build launcher with `npm run tauri build`:
   - Windows: Extract from `target/release/bundle/nsis/` and `target/release/`
   - Linux: Extract from `target/release/bundle/appimage/`
2. Upload via admin panel:
   - Set version (e.g., "1.2.0")
   - Upload Windows installer + executable
   - Upload Linux AppImage
   - Add changelog
3. Verify files accessible at new endpoints
4. Test download from public page

**Verification:**
- All platforms downloadable
- Checksums match
- File sizes correct
- URLs resolve properly

### Phase 4: Launcher Update (Optional)

**Tasks:**
1. Update `LAUNCHER_MANIFEST_URL` to `/executable` endpoint
2. Add `file_type` filtering in file selection logic
3. Add backward compatibility check for old manifests
4. Bump version number
5. Build and upload new launcher version

**Verification:**
- New launcher fetches from `/executable` endpoint
- Backward compatibility preserved for old manifests
- Auto-update works correctly

## Testing Checklist

### Functional Testing
- [ ] Auto-detection serves correct platform (Windows/Linux)
- [ ] Manual platform selection works for all platforms
- [ ] Backward compat redirect preserves existing launcher functionality
- [ ] Existing launchers can still check for updates
- [ ] New launcher endpoints return correct file types
- [ ] SHA256 verification passes on all files
- [ ] File downloads complete successfully (no corruption)

### Admin Panel Testing
- [ ] Multi-file upload handles large files (100MB+)
- [ ] Progress bars show accurate upload progress
- [ ] SHA256 calculation matches server-side
- [ ] Manifest generation includes all uploaded files
- [ ] Version index updated correctly
- [ ] Can list and delete old launcher versions

### Edge Cases
- [ ] Unknown User-Agent returns 300 Multiple Choices
- [ ] Missing platform/file_type returns 404
- [ ] Uploading same version twice shows error
- [ ] Large file uploads don't timeout
- [ ] Network interruption during upload handled gracefully

### Security Testing
- [ ] Admin endpoints require authentication
- [ ] File uploads validate file types
- [ ] Path traversal attacks prevented
- [ ] File size limits enforced

## Rollback Plan

If issues arise after deployment:

1. **Immediate Rollback:** Remove redirect from `/api/launcher/latest`
2. **Restore Behavior:** Make old endpoint serve executables directly
3. **No Impact:** Existing launchers continue working unchanged
4. **Debug:** Investigate issues in staging environment
5. **Re-deploy:** Fix issues and re-deploy when ready

**Risk Assessment:** Low risk due to backward compatibility via redirect.

## Success Criteria

- [ ] First-time users download proper installers (NSIS/AppImage)
- [ ] Auto-updates continue working for all deployed launchers
- [ ] Admin can upload new releases via web UI
- [ ] Platform detection works for 95%+ of users
- [ ] Manual platform selection available as fallback
- [ ] No disruption to existing launcher installations
- [ ] Download page provides professional install experience

## Future Enhancements

1. **macOS Support:** Add .dmg installer and .app bundle executable
2. **Download Statistics:** Track download counts per platform
3. **Delta Updates:** Only download changed files instead of full launcher
4. **Signed Installers:** Code sign Windows NSIS installer for SmartScreen
5. **Auto-Update Notifications:** Push notifications when mandatory updates available
6. **Beta Channel:** Separate beta/stable release channels

## References

- Current implementation: `wowid3-launcher/src-tauri/src/modules/launcher_updater.rs`
- Server storage: `wowid3-server/server/src/storage/launcher.rs`
- Public API: `wowid3-server/server/src/api/public.rs`
- Tauri build config: `wowid3-launcher/src-tauri/tauri.conf.json`
