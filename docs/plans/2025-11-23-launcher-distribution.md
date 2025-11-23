# Launcher Distribution & Update System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate installer distribution from auto-updates with explicit API endpoints and backward compatibility.

**Architecture:** Add `file_type` field to distinguish installers from executables, implement new versioned endpoints with platform detection, maintain backward compatibility via redirect, add admin UI for multi-file uploads.

**Tech Stack:** Rust (Axum), React (TypeScript), Tauri, Multipart form handling

---

## Phase 1: Backend Data Model Changes

### Task 1: Update LauncherFile Model

**Files:**
- Modify: `wowid3-server/server/src/models/manifest.rs:35-42`

**Step 1: Add file_type field to LauncherFile**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherFile {
    pub platform: String,
    #[serde(default)]
    pub file_type: Option<String>,  // "installer" or "executable"
    pub filename: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
}
```

**Step 2: Verify compilation**

Run: `cd wowid3-server/server && cargo build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add wowid3-server/server/src/models/manifest.rs
git commit -m "feat: add file_type field to LauncherFile model"
```

---

### Task 2: Add Platform Detection Helper

**Files:**
- Create: `wowid3-server/server/src/utils/platform.rs`
- Modify: `wowid3-server/server/src/utils/mod.rs`

**Step 1: Create platform detection module**

File: `wowid3-server/server/src/utils/platform.rs`

```rust
use axum::http::HeaderMap;

/// Detect platform from User-Agent header
pub fn detect_platform_from_user_agent(headers: &HeaderMap) -> Option<String> {
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)?
        .to_str()
        .ok()?;

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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    #[test]
    fn test_detect_windows() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        );
        assert_eq!(detect_platform_from_user_agent(&headers), Some("windows".to_string()));
    }

    #[test]
    fn test_detect_linux() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (X11; Linux x86_64)")
        );
        assert_eq!(detect_platform_from_user_agent(&headers), Some("linux".to_string()));
    }

    #[test]
    fn test_detect_unknown() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::USER_AGENT,
            HeaderValue::from_static("Unknown/1.0")
        );
        assert_eq!(detect_platform_from_user_agent(&headers), None);
    }
}
```

**Step 2: Add module export**

File: `wowid3-server/server/src/utils/mod.rs`

Add line:
```rust
pub mod platform;
```

**Step 3: Run tests**

Run: `cd wowid3-server/server && cargo test utils::platform`
Expected: 3 tests pass

**Step 4: Commit**

```bash
git add wowid3-server/server/src/utils/platform.rs wowid3-server/server/src/utils/mod.rs
git commit -m "feat: add platform detection from User-Agent"
```

---

## Phase 2: Backend API Endpoints

### Task 3: Add Installer Endpoint with Auto-Detection

**Files:**
- Modify: `wowid3-server/server/src/api/public.rs` (add after line 112)

**Step 1: Add file serving helper function**

Insert after `get_latest_launcher_manifest` function (around line 112):

```rust
/// Helper: Serve launcher file by platform and file type
async fn serve_launcher_file(
    state: &PublicState,
    platform: &str,
    file_type: &str,
) -> Result<Response, AppError> {
    // Load latest version
    let index = storage::launcher::load_launcher_versions_index(&state.config)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to load versions: {}", e)))?;

    if index.latest.is_empty() {
        return Err(AppError::NotFound("No launcher versions available".to_string()));
    }

    let version = storage::launcher::load_launcher_version(&state.config, &index.latest)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to load version: {}", e)))?;

    // Find matching file
    let file = version
        .files
        .iter()
        .find(|f| {
            f.platform == platform &&
            f.file_type.as_deref() == Some(file_type)
        })
        .ok_or_else(|| {
            AppError::NotFound(format!("No {} available for {}", file_type, platform))
        })?;

    // Get file path
    let file_path = state.config.launcher_version_path(&version.version).join(&file.filename);

    if !file_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", file.filename)));
    }

    // Stream file
    let file_handle = fs::File::open(&file_path)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to open file: {}", e)))?;

    let stream = ReaderStream::new(file_handle);
    let body = Body::from_stream(stream);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", file.filename),
        )
        .header(header::CONTENT_LENGTH, file.size.to_string())
        .body(body)
        .map_err(|e| AppError::InternalError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}
```

**Step 2: Add installer endpoint with auto-detection**

Add after `serve_launcher_file`:

```rust
/// GET /api/launcher/latest/installer - Auto-detect platform and serve installer
pub async fn get_launcher_installer(
    headers: HeaderMap,
    State(state): State<PublicState>,
) -> Result<Response, AppError> {
    use crate::utils::platform::detect_platform_from_user_agent;

    let platform = detect_platform_from_user_agent(&headers)
        .ok_or_else(|| {
            AppError::BadRequest(
                "Could not detect platform from User-Agent. Use /api/launcher/latest/installer/{platform}".to_string()
            )
        })?;

    serve_launcher_file(&state, &platform, "installer").await
}
```

**Step 3: Verify compilation**

Run: `cd wowid3-server/server && cargo build`
Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add wowid3-server/server/src/api/public.rs
git commit -m "feat: add installer endpoint with auto platform detection"
```

---

### Task 4: Add Installer Endpoint with Explicit Platform

**Files:**
- Modify: `wowid3-server/server/src/api/public.rs` (add after previous function)

**Step 1: Add explicit platform endpoint**

```rust
/// GET /api/launcher/latest/installer/{platform}
pub async fn get_launcher_installer_platform(
    Path(platform): Path<String>,
    State(state): State<PublicState>,
) -> Result<Response, AppError> {
    // Validate platform
    if !matches!(platform.as_str(), "windows" | "linux" | "macos") {
        return Err(AppError::BadRequest(format!("Invalid platform: {}", platform)));
    }

    serve_launcher_file(&state, &platform, "installer").await
}
```

**Step 2: Verify compilation**

Run: `cd wowid3-server/server && cargo build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add wowid3-server/server/src/api/public.rs
git commit -m "feat: add installer endpoint with explicit platform selection"
```

---

### Task 5: Add Executable Endpoints

**Files:**
- Modify: `wowid3-server/server/src/api/public.rs`

**Step 1: Add executable auto-detect endpoint**

```rust
/// GET /api/launcher/latest/executable - Auto-detect platform and serve executable
pub async fn get_launcher_executable(
    headers: HeaderMap,
    State(state): State<PublicState>,
) -> Result<Response, AppError> {
    use crate::utils::platform::detect_platform_from_user_agent;

    let platform = detect_platform_from_user_agent(&headers)
        .ok_or_else(|| {
            AppError::BadRequest(
                "Could not detect platform from User-Agent. Use /api/launcher/latest/executable/{platform}".to_string()
            )
        })?;

    serve_launcher_file(&state, &platform, "executable").await
}

/// GET /api/launcher/latest/executable/{platform}
pub async fn get_launcher_executable_platform(
    Path(platform): Path<String>,
    State(state): State<PublicState>,
) -> Result<Response, AppError> {
    // Validate platform
    if !matches!(platform.as_str(), "windows" | "linux" | "macos") {
        return Err(AppError::BadRequest(format!("Invalid platform: {}", platform)));
    }

    serve_launcher_file(&state, &platform, "executable").await
}
```

**Step 2: Verify compilation**

Run: `cd wowid3-server/server && cargo build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add wowid3-server/server/src/api/public.rs
git commit -m "feat: add executable endpoints for auto-updates"
```

---

### Task 6: Add Backward Compatibility Redirect

**Files:**
- Modify: `wowid3-server/server/src/api/public.rs`

**Step 1: Add redirect function**

```rust
/// GET /api/launcher/latest - Redirect to executable endpoint (backward compat)
pub async fn get_latest_launcher_redirect() -> Redirect {
    Redirect::permanent("/api/launcher/latest/executable")
}
```

**Step 2: Verify compilation**

Run: `cd wowid3-server/server && cargo build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add wowid3-server/server/src/api/public.rs
git commit -m "feat: add backward compatibility redirect for existing launchers"
```

---

### Task 7: Register New Routes

**Files:**
- Modify: `wowid3-server/server/src/main.rs` (around line 80-120 where routes are defined)

**Step 1: Import Redirect**

Add to imports at top of file:
```rust
use axum::response::Redirect;
```

**Step 2: Add new routes**

Find the public routes section and update the `/api/launcher` routes:

```rust
// Launcher endpoints
.route("/api/launcher/latest", get(api::public::get_latest_launcher_redirect))
.route("/api/launcher/latest/installer", get(api::public::get_launcher_installer))
.route("/api/launcher/latest/installer/:platform", get(api::public::get_launcher_installer_platform))
.route("/api/launcher/latest/executable", get(api::public::get_launcher_executable))
.route("/api/launcher/latest/executable/:platform", get(api::public::get_launcher_executable_platform))
```

**Step 3: Verify compilation**

Run: `cd wowid3-server/server && cargo build`
Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add wowid3-server/server/src/main.rs
git commit -m "feat: register new launcher distribution routes"
```

---

## Phase 3: Admin API for Release Upload

### Task 8: Add Admin Launcher Release Upload Endpoint

**Files:**
- Modify: `wowid3-server/server/src/api/admin.rs` (add at end of file, before closing brace)

**Step 1: Add multipart upload handler**

```rust
use axum::extract::Multipart;
use sha2::{Digest, Sha256};

/// POST /api/admin/launcher/releases - Upload new launcher release
pub async fn create_launcher_release(
    headers: HeaderMap,
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> Result<Json<LauncherVersion>, AppError> {
    // Verify admin token
    verify_admin_token(&headers, &state.config)?;

    let mut version = String::new();
    let mut changelog = String::new();
    let mut mandatory = false;
    let mut files: Vec<(String, String, String, Vec<u8>)> = vec![]; // (platform, file_type, filename, bytes)

    // Parse multipart form
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::BadRequest(format!("Failed to read multipart field: {}", e))
    })? {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "version" => {
                version = field.text().await.map_err(|e| {
                    AppError::BadRequest(format!("Failed to read version: {}", e))
                })?;
            }
            "changelog" => {
                changelog = field.text().await.map_err(|e| {
                    AppError::BadRequest(format!("Failed to read changelog: {}", e))
                })?;
            }
            "mandatory" => {
                let text = field.text().await.map_err(|e| {
                    AppError::BadRequest(format!("Failed to read mandatory: {}", e))
                })?;
                mandatory = text == "true";
            }
            "windows_installer" => {
                let bytes = field.bytes().await.map_err(|e| {
                    AppError::BadRequest(format!("Failed to read windows_installer: {}", e))
                })?.to_vec();
                let filename = format!("WOWID3Launcher-Setup-{}.exe", version);
                files.push(("windows".to_string(), "installer".to_string(), filename, bytes));
            }
            "windows_executable" => {
                let bytes = field.bytes().await.map_err(|e| {
                    AppError::BadRequest(format!("Failed to read windows_executable: {}", e))
                })?.to_vec();
                let filename = "WOWID3Launcher.exe".to_string();
                files.push(("windows".to_string(), "executable".to_string(), filename, bytes));
            }
            "linux_appimage" => {
                let bytes = field.bytes().await.map_err(|e| {
                    AppError::BadRequest(format!("Failed to read linux_appimage: {}", e))
                })?.to_vec();
                let filename = format!("WOWID3Launcher-{}.AppImage", version);
                // Add for both installer and executable
                files.push(("linux".to_string(), "installer".to_string(), filename.clone(), bytes.clone()));
                files.push(("linux".to_string(), "executable".to_string(), filename, bytes));
            }
            _ => {
                // Unknown field, skip
            }
        }
    }

    // Validate version
    if version.is_empty() {
        return Err(AppError::BadRequest("Version is required".to_string()));
    }

    if files.is_empty() {
        return Err(AppError::BadRequest("At least one file is required".to_string()));
    }

    // Create version directory
    let version_dir = state.config.launcher_version_path(&version);
    fs::create_dir_all(&version_dir).await.map_err(|e| {
        AppError::InternalError(format!("Failed to create version directory: {}", e))
    })?;

    // Process and save files
    let mut launcher_files = Vec::new();

    for (platform, file_type, filename, bytes) in files {
        // Calculate SHA256
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let sha256 = format!("{:x}", hasher.finalize());

        // Save file
        let file_path = version_dir.join(&filename);
        fs::write(&file_path, &bytes).await.map_err(|e| {
            AppError::InternalError(format!("Failed to write file: {}", e))
        })?;

        // Generate URL
        let url = format!(
            "{}/files/launcher/{}/{}",
            state.config.base_url, version, filename
        );

        launcher_files.push(LauncherFile {
            platform,
            file_type: Some(file_type),
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
    storage::launcher::save_launcher_version(&state.config, &launcher_version)
        .await
        .map_err(|e| {
            AppError::InternalError(format!("Failed to save launcher version: {}", e))
        })?;

    Ok(Json(launcher_version))
}
```

**Step 2: Register admin route**

Find the admin routes section in `main.rs` and add:

```rust
.route("/api/admin/launcher/releases", post(api::admin::create_launcher_release))
```

**Step 3: Verify compilation**

Run: `cd wowid3-server/server && cargo build`
Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add wowid3-server/server/src/api/admin.rs wowid3-server/server/src/main.rs
git commit -m "feat: add admin API for launcher release uploads"
```

---

## Phase 4: Admin Panel Frontend

### Task 9: Create Launcher Release Editor Component

**Files:**
- Create: `wowid3-server/web/src/pages/LauncherReleaseEditor.tsx`

**Step 1: Create component file**

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface LauncherReleaseForm {
  version: string;
  changelog: string;
  mandatory: boolean;
  windowsInstaller: File | null;
  windowsExecutable: File | null;
  linuxAppImage: File | null;
}

export function LauncherReleaseEditor() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LauncherReleaseForm>({
    version: '',
    changelog: '',
    mandatory: false,
    windowsInstaller: null,
    windowsExecutable: null,
    linuxAppImage: null,
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
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

      await api.post('/admin/launcher/releases', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      navigate('/admin/launcher');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload release');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create Launcher Release</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Version */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Version (e.g., 1.2.0)
          </label>
          <input
            type="text"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            required
            placeholder="1.2.0"
          />
        </div>

        {/* Changelog */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Changelog
          </label>
          <textarea
            value={form.changelog}
            onChange={(e) => setForm({ ...form, changelog: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            rows={6}
            required
            placeholder="- Feature: Added new functionality&#10;- Fix: Resolved bug"
          />
        </div>

        {/* Mandatory */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={form.mandatory}
              onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium">Mandatory Update</span>
          </label>
        </div>

        {/* Windows Installer */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Windows Installer (.exe from bundle/nsis/)
          </label>
          <input
            type="file"
            accept=".exe"
            onChange={(e) =>
              setForm({ ...form, windowsInstaller: e.target.files?.[0] || null })
            }
            className="w-full"
          />
          {form.windowsInstaller && (
            <p className="text-sm text-gray-600 mt-1">
              {form.windowsInstaller.name} ({(form.windowsInstaller.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Windows Executable */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Windows Executable (.exe from target/release/)
          </label>
          <input
            type="file"
            accept=".exe"
            onChange={(e) =>
              setForm({ ...form, windowsExecutable: e.target.files?.[0] || null })
            }
            className="w-full"
          />
          {form.windowsExecutable && (
            <p className="text-sm text-gray-600 mt-1">
              {form.windowsExecutable.name} ({(form.windowsExecutable.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Linux AppImage */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Linux AppImage (.AppImage from bundle/appimage/)
          </label>
          <input
            type="file"
            accept=".AppImage"
            onChange={(e) =>
              setForm({ ...form, linuxAppImage: e.target.files?.[0] || null })
            }
            className="w-full"
          />
          {form.linuxAppImage && (
            <p className="text-sm text-gray-600 mt-1">
              {form.linuxAppImage.name} ({(form.linuxAppImage.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {uploading ? 'Uploading...' : 'Create Release'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/launcher')}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add wowid3-server/web/src/pages/LauncherReleaseEditor.tsx
git commit -m "feat: add launcher release editor UI component"
```

---

### Task 10: Add Launcher Release List Page

**Files:**
- Create: `wowid3-server/web/src/pages/LauncherReleasesList.tsx`

**Step 1: Create list component**

```typescript
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface LauncherVersion {
  version: string;
  files: Array<{
    platform: string;
    file_type: string;
    filename: string;
    size: number;
  }>;
  changelog: string;
  mandatory: boolean;
  released_at: string;
}

export function LauncherReleasesList() {
  const [versions, setVersions] = useState<LauncherVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      const response = await api.get('/admin/launcher/releases');
      setVersions(response.data);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Launcher Releases</h1>
        <Link
          to="/admin/launcher/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create New Release
        </Link>
      </div>

      <div className="space-y-4">
        {versions.map((version) => (
          <div
            key={version.version}
            className="border rounded-lg p-4 hover:shadow-lg transition"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-xl font-bold">
                  Version {version.version}
                  {version.mandatory && (
                    <span className="ml-2 text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                      Mandatory
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  Released: {new Date(version.released_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mb-3">
              <h3 className="font-semibold mb-1">Files:</h3>
              <ul className="text-sm space-y-1">
                {version.files.map((file, idx) => (
                  <li key={idx} className="text-gray-700">
                    {file.platform} ({file.file_type}): {file.filename} (
                    {(file.size / 1024 / 1024).toFixed(2)} MB)
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-1">Changelog:</h3>
              <pre className="text-sm bg-gray-50 p-2 rounded whitespace-pre-wrap">
                {version.changelog}
              </pre>
            </div>
          </div>
        ))}

        {versions.length === 0 && (
          <div className="text-center text-gray-600 py-12">
            No launcher releases yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add wowid3-server/web/src/pages/LauncherReleasesList.tsx
git commit -m "feat: add launcher releases list page"
```

---

### Task 11: Add Routes to Admin App

**Files:**
- Modify: `wowid3-server/web/src/App.tsx`

**Step 1: Import new components**

Add to imports:
```typescript
import { LauncherReleasesList } from './pages/LauncherReleasesList';
import { LauncherReleaseEditor } from './pages/LauncherReleaseEditor';
```

**Step 2: Add routes**

Add routes inside the `<Routes>` component:
```typescript
<Route path="/admin/launcher" element={<LauncherReleasesList />} />
<Route path="/admin/launcher/new" element={<LauncherReleaseEditor />} />
```

**Step 3: Verify compilation**

Run: `cd wowid3-server/web && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add wowid3-server/web/src/App.tsx
git commit -m "feat: add launcher release routes to admin app"
```

---

### Task 12: Add Admin API Endpoint for Listing Releases

**Files:**
- Modify: `wowid3-server/server/src/api/admin.rs`

**Step 1: Add list endpoint**

```rust
/// GET /api/admin/launcher/releases - List all launcher releases
pub async fn list_launcher_releases(
    headers: HeaderMap,
    State(state): State<AdminState>,
) -> Result<Json<Vec<LauncherVersion>>, AppError> {
    // Verify admin token
    verify_admin_token(&headers, &state.config)?;

    // Load versions index
    let index = storage::launcher::load_launcher_versions_index(&state.config)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to load versions: {}", e)))?;

    // Load all versions
    let mut versions = Vec::new();
    for version_num in &index.versions {
        if let Ok(version) = storage::launcher::load_launcher_version(&state.config, version_num).await {
            versions.push(version);
        }
    }

    Ok(Json(versions))
}
```

**Step 2: Register route**

In `main.rs`, add to admin routes:
```rust
.route("/api/admin/launcher/releases", get(api::admin::list_launcher_releases))
```

**Step 3: Verify compilation**

Run: `cd wowid3-server/server && cargo build`
Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add wowid3-server/server/src/api/admin.rs wowid3-server/server/src/main.rs
git commit -m "feat: add admin API for listing launcher releases"
```

---

## Phase 5: Launcher Client Updates

### Task 13: Update Launcher Manifest URL

**Files:**
- Modify: `wowid3-launcher/src-tauri/src/modules/launcher_updater.rs:12`

**Step 1: Update constant**

Change line 12:
```rust
const LAUNCHER_MANIFEST_URL: &str = "https://wowid-launcher.frostdev.io/api/launcher/latest/executable";
```

**Step 2: Verify compilation**

Run: `cd wowid3-launcher/src-tauri && cargo build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add wowid3-launcher/src-tauri/src/modules/launcher_updater.rs
git commit -m "feat: update launcher to use new executable endpoint"
```

---

### Task 14: Add file_type Filtering to Launcher

**Files:**
- Modify: `wowid3-launcher/src-tauri/src/modules/launcher_updater.rs:106-110`

**Step 1: Update file selection logic**

Replace the file finding logic (around line 107-109):

```rust
// Find the file for the current platform with file_type = "executable"
let platform_file = launcher_version.files.iter()
    .find(|f| {
        f.platform == current_platform &&
        (f.file_type.as_deref() == Some("executable") || f.file_type.is_none())
    })
    .context(format!("No executable found for platform: {}", current_platform))?;
```

**Step 2: Verify compilation**

Run: `cd wowid3-launcher/src-tauri && cargo build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add wowid3-launcher/src-tauri/src/modules/launcher_updater.rs
git commit -m "feat: add file_type filtering with backward compatibility"
```

---

## Phase 6: Testing & Deployment

### Task 15: Manual Testing Checklist

**Step 1: Start development server**

Run in separate terminal:
```bash
cd wowid3-server/server && cargo run
```

**Step 2: Test platform detection**

```bash
# Test Windows detection
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  http://localhost:8080/api/launcher/latest/installer

# Test Linux detection
curl -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64)" \
  http://localhost:8080/api/launcher/latest/installer

# Test unknown (should error)
curl -H "User-Agent: Unknown/1.0" \
  http://localhost:8080/api/launcher/latest/installer
```

Expected: Windows and Linux return 404 (no files yet), Unknown returns 400 Bad Request

**Step 3: Test backward compatibility redirect**

```bash
curl -I http://localhost:8080/api/launcher/latest
```

Expected: 308 Permanent Redirect to `/api/launcher/latest/executable`

**Step 4: Test admin file upload**

1. Open admin panel: `http://localhost:5173/admin/launcher/new`
2. Fill in version: `1.2.0-test`
3. Add changelog
4. Upload test files (can use dummy files for testing)
5. Submit

Expected: Release created successfully, appears in list

**Step 5: Document test results**

Create file: `docs/testing/launcher-distribution-manual-tests.md` with results

**Step 6: Commit**

```bash
git add docs/testing/launcher-distribution-manual-tests.md
git commit -m "docs: add manual testing results for launcher distribution"
```

---

### Task 16: Update Documentation

**Files:**
- Modify: `CLAUDE.md` (add new section about launcher distribution)

**Step 1: Add API documentation section**

Add to the "API Endpoints (Modpack Server)" section:

```markdown
### Launcher Distribution (Public API)

**Installers** (for first-time downloads):
- `GET /api/launcher/latest/installer` - Auto-detect platform, serve installer
- `GET /api/launcher/latest/installer/{platform}` - Explicit platform installer

**Executables** (for auto-updates):
- `GET /api/launcher/latest/executable` - Auto-detect platform, serve executable
- `GET /api/launcher/latest/executable/{platform}` - Explicit platform executable

**Backward Compatibility**:
- `GET /api/launcher/latest` - Redirects to `/api/launcher/latest/executable`

### Launcher Management (Admin API)

**Releases**:
- `GET /api/admin/launcher/releases` - List all launcher releases
- `POST /api/admin/launcher/releases` - Upload new release (multipart form)
  - Form fields: `version`, `changelog`, `mandatory`, `windows_installer`, `windows_executable`, `linux_appimage`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update API documentation for launcher distribution"
```

---

### Task 17: Final Build and Deployment Prep

**Step 1: Build release binaries**

```bash
# Server
cd wowid3-server/server && cargo build --release

# Admin panel
cd wowid3-server/web && npm run build
```

**Step 2: Verify no errors**

Expected: Both build successfully

**Step 3: Create deployment notes**

Create file: `docs/deployment/launcher-distribution-deploy.md`

```markdown
# Launcher Distribution Deployment Guide

## Pre-Deployment

1. Merge feature branch to main
2. Build production binaries
3. Backup current server state

## Deployment Steps

1. Deploy server backend:
   ```bash
   scp wowid3-server/server/target/release/wowid3-modpack-server pma@192.168.10.43:/tmp/
   ssh pma@192.168.10.43 'sudo systemctl stop wowid3-server && sudo mv /tmp/wowid3-modpack-server /opt/wowid3-server/wowid3-modpack-server && sudo chmod +x /opt/wowid3-server/wowid3-modpack-server && sudo systemctl start wowid3-server'
   ```

2. Deploy admin panel:
   ```bash
   cd wowid3-server/web && npm run build
   rsync -av --delete dist/ pma@192.168.10.43:/var/www/wowid3-admin/
   ```

3. Verify API endpoints:
   ```bash
   curl -I https://wowid-launcher.frostdev.io/api/launcher/latest
   ```

## Post-Deployment

1. Upload first launcher release via admin panel
2. Test installer downloads
3. Test auto-update from old launcher
4. Monitor logs for errors
```

**Step 4: Commit**

```bash
git add docs/deployment/launcher-distribution-deploy.md
git commit -m "docs: add deployment guide for launcher distribution"
```

---

### Task 18: Merge to Main

**Step 1: Ensure all changes committed**

```bash
git status
```

Expected: Working tree clean

**Step 2: Push feature branch**

```bash
git push origin feature/launcher-distribution
```

**Step 3: Create pull request (or merge directly)**

```bash
# If merging directly:
git checkout main
git merge feature/launcher-distribution
git push origin main
```

**Step 4: Clean up worktree**

**REQUIRED SUB-SKILL:** Use @superpowers:finishing-a-development-branch

---

## Success Criteria

- [ ] Platform detection works for Windows/Linux/macOS
- [ ] Installer endpoints serve correct files
- [ ] Executable endpoints serve correct files
- [ ] Backward compatibility redirect works
- [ ] Admin can upload multi-file releases
- [ ] File SHA256 calculated and verified
- [ ] Launcher clients can still auto-update
- [ ] No breaking changes to existing deployments

## Implementation Notes

- All file uploads handled via multipart form data
- SHA256 calculated server-side for security
- Platform detection via User-Agent header
- Backward compatibility via 308 redirect
- Admin UI built with React + TypeScript
- Server endpoints use Axum framework

## Future Enhancements

- macOS support (.dmg installer)
- Download statistics tracking
- Delta updates (only changed files)
- Code signing for Windows installer
- Beta/stable release channels
