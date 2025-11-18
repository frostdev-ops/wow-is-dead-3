# WOWID3 Launcher-Server API Communication Protocol

## Overview

This document specifies the HTTP API communication protocol between the WOWID3 Launcher (Tauri desktop application) and the WOWID3 Modpack Server (Axum backend).

The launcher communicates with the server exclusively via public HTTP APIs. All public endpoints require no authentication and are accessible to all launcher clients.

---

## Server Configuration

### Base URL Configuration
- **Default:** `https://wowid-launcher.frostdev.io`
- **Configuration Location:** Server `.env` file
- **Environment Variable:** `BASE_URL`
- **Config File:** `wowid3-server/server/src/config.rs`

### CORS Configuration
- **Default Mode:** Permissive CORS
- **Dev Mode:** If `CORS_ORIGIN` is set in `.env`, restricts to specific origin
- **Production Mode:** Permissive CORS (allow all origins)
- **Configuration File:** `wowid3-server/server/src/main.rs` (lines 93-99)

```rust
let cors = if let Some(origin) = &config.cors_origin {
    CorsLayer::permissive() // Dev mode
        .allow_origin(origin.parse::<http::HeaderValue>().unwrap())
} else {
    CorsLayer::permissive() // Production
};
```

### Launcher Base URL Configuration
- **Default:** `https://wowid-launcher.frostdev.io/api/manifest/latest`
- **Stored In:** Zustand `useSettingsStore` (persisted to localStorage)
- **Configuration Key:** `wowid3-settings`
- **User-Configurable:** Yes, via settings
- **Fallback URL:** If invalid, migrates to default in `settingsStore.ts` (line 144)

**Settings Storage** (`wowid3-launcher/src/stores/settingsStore.ts`):
```typescript
manifestUrl: 'https://wowid-launcher.frostdev.io/api/manifest/latest',
// Also stored:
serverAddress: 'mc.frostdev.io:25565' // Minecraft server, not modpack server
```

---

## Public API Endpoints (No Authentication Required)

### 1. Get Latest Modpack Manifest

**Endpoint:** `GET /api/manifest/latest`

**Purpose:** Fetch the latest available modpack manifest

**Base URL:** Configurable, default: `https://wowid-launcher.frostdev.io`

**Full URL Example:** `https://wowid-launcher.frostdev.io/api/manifest/latest`

**Query Parameters:** None

**Request Headers:**
```
GET /api/manifest/latest HTTP/1.1
Host: wowid-launcher.frostdev.io
User-Agent: Tauri (compatible with Tauri client)
Accept: application/json
```

**Response Status Code:** `200 OK`

**Response Content-Type:** `application/json`

**Response Body:**
```json
{
  "version": "1.2.3",
  "minecraft_version": "1.20.1",
  "fabric_loader": "0.17.3",
  "changelog": "Fixed critical bugs, updated mods",
  "files": [
    {
      "path": "mods/mod1.jar",
      "url": "https://wowid-launcher.frostdev.io/files/1.2.3/mods/mod1.jar",
      "sha256": "a1b2c3d4e5f6...",
      "size": 1048576
    },
    {
      "path": "mods/mod2.jar",
      "url": "https://wowid-launcher.frostdev.io/files/1.2.3/mods/mod2.jar",
      "sha256": "f6e5d4c3b2a1...",
      "size": 2097152
    }
  ]
}
```

**Response Structure (Manifest):**
| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Semantic version (e.g., "1.2.3") |
| `minecraft_version` | string | Target Minecraft version (e.g., "1.20.1") |
| `fabric_loader` | string | Fabric loader version (e.g., "0.17.3") |
| `changelog` | string | Human-readable changelog text |
| `files` | array | List of modpack files to download |

**File Entry Structure:**
| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Relative path in game directory (e.g., "mods/mod1.jar") |
| `url` | string | Full URL to download the file |
| `sha256` | string | SHA-256 hash (lowercase hex) for verification |
| `size` | number | File size in bytes |

**HTTP Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Latest manifest does not exist
- `500 Internal Server Error` - Server error

**Error Response (404):**
```json
{
  "error": "Latest manifest not found"
}
```

**Error Response (500):**
```json
{
  "error": "Internal server error"
}
```

**Launcher Implementation:**
- File: `wowid3-launcher/src-tauri/src/modules/updater.rs`
- Function: `check_for_updates()` (line 47)
- HTTP Client: `reqwest::Client` with 10-second timeout
- Timeout: `MANIFEST_FETCH_TIMEOUT_SECS = 10` (line 17)
- Called by: `useModpack.ts` hook (line 44)

---

### 2. Get Manifest by Version

**Endpoint:** `GET /api/manifest/:version`

**Purpose:** Fetch a specific version's manifest (for history/rollback)

**URL Parameters:**
- `:version` (string) - Semantic version identifier (e.g., "1.2.3")

**Full URL Example:** `https://wowid-launcher.frostdev.io/api/manifest/1.2.3`

**Request Headers:**
```
GET /api/manifest/1.2.3 HTTP/1.1
Host: wowid-launcher.frostdev.io
Accept: application/json
```

**Response Status Code:** `200 OK`

**Response Content-Type:** `application/json`

**Response Body:** Same as `/api/manifest/latest` response

**HTTP Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Version manifest does not exist
- `500 Internal Server Error` - Server error

**Launcher Implementation:**
- File: `wowid3-launcher/src-tauri/src/modules/updater.rs`
- Function: `check_for_updates()` (uses same function for both endpoints)

---

### 3. Download Modpack Files

**Endpoint:** `GET /files/:version/*path`

**Purpose:** Download individual modpack files

**URL Parameters:**
- `:version` (string) - Modpack version (e.g., "1.2.3")
- `*path` (string) - Relative file path with wildcards (e.g., "mods/mod1.jar", "config/settings.ini")

**Full URL Example:** `https://wowid-launcher.frostdev.io/files/1.2.3/mods/mod1.jar`

**Request Headers:**
```
GET /files/1.2.3/mods/mod1.jar HTTP/1.1
Host: wowid-launcher.frostdev.io
Range: bytes=0-1023 (optional, for resume)
```

**Response Status Code:** `200 OK` (or `206 Partial Content` if Range header used)

**Response Headers:**
```
Content-Type: application/octet-stream (or specific MIME type)
Content-Length: [file size]
Content-Disposition: attachment; filename="mod1.jar"
```

**Response Body:** Binary file content

**HTTP Status Codes:**
- `200 OK` - Success (full file)
- `206 Partial Content` - Partial file (Range request)
- `404 Not Found` - File or version does not exist
- `403 Forbidden` - File is blacklisted and cannot be accessed
- `500 Internal Server Error` - Server error

**Error Response (404):**
```json
{
  "error": "File mods/mod1.jar not found"
}
```

**Error Response (403):**
```json
{
  "error": "File access denied"
}
```

**Security Features:**
- Path traversal prevention: Validates file is within release directory
- Blacklist enforcement: Blocks download of blacklisted files (e.g., player data, configs)
- Blacklist patterns: Glob patterns (e.g., `*.txt`, `config/**`)
- File: `wowid3-server/server/src/api/public.rs` (lines 114-168)

**Launcher Implementation:**
- File: `wowid3-launcher/src-tauri/src/modules/download_manager.rs`
- Function: `download_file()` (line 76)
- Uses `reqwest::Client` with streaming downloads
- Validates SHA-256 hash after download completes
- Concurrent downloads with semaphore-based limiting

---

### 4. Download Java Runtime

**Endpoint:** `GET /api/java/:filename`

**Purpose:** Download Azul Zulu JVM 21 for the appropriate platform

**URL Parameters:**
- `:filename` (string) - Platform-specific Java archive filename

**Allowed Filenames:**
- `zulu21-windows-x64.zip` - Windows 64-bit
- `zulu21-macos-x64.tar.gz` - macOS Intel
- `zulu21-macos-aarch64.tar.gz` - macOS Apple Silicon
- `zulu21-linux-x64.tar.gz` - Linux 64-bit

**Full URL Example:** `https://wowid-launcher.frostdev.io/api/java/zulu21-linux-x64.tar.gz`

**Request Headers:**
```
GET /api/java/zulu21-linux-x64.tar.gz HTTP/1.1
Host: wowid-launcher.frostdev.io
```

**Response Status Code:** `200 OK`

**Response Headers:**
```
Content-Type: application/zip (for .zip)
Content-Type: application/gzip (for .tar.gz)
Content-Disposition: attachment; filename="zulu21-linux-x64.tar.gz"
```

**Response Body:** Binary Java archive

**HTTP Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Requested Java version/platform not available
- `500 Internal Server Error` - Server error

**Error Response (404):**
```json
{
  "error": "Java runtime zulu21-linux-x64.tar.gz not found"
}
```

**Security Features:**
- Whitelist enforcement: Only allows downloading predefined filenames
- Prevents arbitrary file access

**Launcher Implementation:**
- File: `wowid3-launcher/src-tauri/src/lib.rs` (lines 101-102)
- Hardcoded URL: `https://wowid-launcher.frostdev.io/api/java`
- File: `wowid3-launcher/src-tauri/src/modules/java_runtime.rs`
- Function: `download_and_cache_java()`
- Caching: Java is extracted and cached locally to avoid re-downloading

---

### 5. Server Health Check

**Endpoint:** `GET /health`

**Purpose:** Health check endpoint (implicit support)

**Full URL Example:** `https://wowid-launcher.frostdev.io/health`

**Request Headers:**
```
GET /health HTTP/1.1
Host: wowid-launcher.frostdev.io
Accept: application/json
```

**Response Status Code:** `200 OK`

**Response Content-Type:** `application/json`

**Response Body:**
```json
{
  "status": "ok",
  "service": "wowid3-modpack-server"
}
```

**HTTP Status Codes:**
- `200 OK` - Server is running

**Server Implementation:**
- File: `wowid3-server/server/src/main.rs` (lines 164-169)

---

## Client-Side HTTP Configuration

### Timeout Settings

**Manifest Fetching:**
```rust
const MANIFEST_FETCH_TIMEOUT_SECS: u64 = 10;  // updater.rs line 17
```

**Download Manager:**
```rust
.connect_timeout(Duration::from_secs(30))
.timeout(Duration::from_secs(300))           // 5 minutes per download
```
File: `download_manager.rs` (lines 61-62)

**Server Ping (Minecraft):**
```rust
Duration::from_secs(5)  // 5-second timeout for TCP connection
```
File: `server.rs` (line 196)

### HTTP Client Configuration

**Download Manager HTTP Client:**
```rust
let client = Client::builder()
    .pool_max_idle_per_host(max_concurrent)
    .pool_idle_timeout(Duration::from_secs(90))
    .connect_timeout(Duration::from_secs(30))
    .timeout(Duration::from_secs(300))
    .build()
```
File: `download_manager.rs` (lines 58-64)

**Manifest HTTP Client:**
```rust
let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(MANIFEST_FETCH_TIMEOUT_SECS))
    .build()
```
File: `updater.rs` (lines 50-53)

---

## Error Handling & Retry Logic

### Manifest Fetch Error Handling

**File:** `wowid3-launcher/src-tauri/src/modules/updater.rs` (lines 47-84)

**Retry Policy:**
- No automatic retries for manifest fetch
- Timeout: 10 seconds
- Errors are propagated to the caller

**Error Cases:**
1. **Network Failure:**
   ```
   Failed to fetch manifest from URL 'https://...'. 
   Check your network connection and verify the server is reachable.
   ```

2. **HTTP Status Errors:**
   ```
   Manifest request failed with HTTP status 404: Not Found (URL: https://...)
   ```

3. **Invalid JSON:**
   ```
   Failed to parse manifest JSON - server returned invalid JSON
   ```

**Launcher Error Handling (useModpack hook):**
- File: `wowid3-launcher/src/hooks/useModpack.ts` (lines 70-72)
- Errors are caught and logged
- User is notified via error state
- No automatic retries at the React level

### Download Manager Retry Logic

**File:** `wowid3-launcher/src-tauri/src/modules/download_manager.rs` (lines 76-123)

**Retry Configuration:**
```rust
pub async fn download_file(
    &self,
    task: DownloadTask,
    progress_tx: Option<mpsc::Sender<DownloadProgress>>,
) -> Result<()>
```

**Retry Behavior:**
- **Max Retries:** `MAX_DOWNLOAD_RETRIES = 3` (updater.rs line 16)
- **Backoff Strategy:** Exponential backoff
  - Attempt 1: 2^0 = 1 second delay
  - Attempt 2: 2^1 = 2 second delay
  - Attempt 3: 2^2 = 4 second delay
- **Total Timeout per File:** 300 seconds (5 minutes)

**Backoff Implementation:**
```rust
let backoff = Duration::from_secs(2_u64.pow(attempt));
eprintln!("Download failed (attempt {}/{}): {}. Retrying in {:?}",
    attempt + 1, self.max_retries + 1, e, backoff);
tokio::time::sleep(backoff).await;
attempt += 1;
```
(Lines 110-120)

**Error Cases Triggering Retry:**
1. Network connection failures
2. HTTP status errors (4xx, 5xx)
3. Incomplete downloads
4. Timeout errors

**Non-Retryable Errors:**
1. Hash verification failures (SHA-256 mismatch) - downloads corrupted file
2. Path traversal attempts - security violation
3. Blacklisted file access - policy violation

### Hash Verification

**File:** `wowid3-launcher/src-tauri/src/modules/download_manager.rs` (lines 234-252)

**Verification Method:**
```rust
fn verify_hash(hasher: Box<dyn Hasher>, expected: &HashType, path: &Path) -> Result<()>
```

**Error on Mismatch:**
```
Hash mismatch for /path/to/file.jar: expected abc123..., got def456...
```

**Supported Algorithms:**
- SHA-256 (primary)
- SHA-1 (legacy support)

**Behavior on Failure:**
- File is deleted (implicitly, no retry)
- Error is returned to caller
- User must manually retry or repair

### Network Failure Handling

**Timeout Scenarios:**

| Scenario | Timeout | Behavior |
|----------|---------|----------|
| Manifest fetch | 10 sec | Fails immediately, user retries |
| Download connect | 30 sec | Retries up to 3 times with backoff |
| Download read | 300 sec | Retries up to 3 times with backoff |
| Server ping | 5 sec | Returns offline status |

**Connection Errors:**
- `Failed to send request` - Retryable
- `Failed to read chunk` - Retryable
- `Failed to write chunk` - Non-retryable (disk error)
- `HTTP error response` - Retryable if 5xx, non-retryable if 4xx

**DNS Resolution:**
- Handled by `reqwest` client
- Failed resolution causes immediate error
- No retry at launcher level

### Concurrent Download Management

**File:** `wowid3-launcher/src-tauri/src/modules/download_manager.rs` (lines 193-224)

**Concurrency Control:**
```rust
pub struct DownloadManager {
    client: Client,
    semaphore: Arc<Semaphore>,
    max_retries: u32,
}
```

**Configuration:**
- **Max Concurrent Downloads:** Calculated based on CPU cores (line 281-292)
  - 1-2 cores: 15 concurrent
  - 3-4 cores: 25 concurrent
  - 5-8 cores: 35 concurrent
  - 9+ cores: 50 concurrent
- **Max Queued Tasks:** 1000 (line 212)

**Download Scheduling:**
```rust
let results: Vec<Result<()>> = stream::iter(sorted_tasks)
    .map(|task| { ... })
    .buffer_unordered(1000)  // Queue up to 1000 tasks
    .collect()
    .await;
```

**Priority System:**
```rust
pub enum DownloadPriority {
    High = 3,     // Libraries
    Medium = 2,   // Assets
    Low = 1,      // Modpack files
}
```
Tasks are sorted by priority before download (line 203)

---

## Request/Response Formats

### Manifest Request Format

**Type:** Standard HTTP GET request

**cURL Example:**
```bash
curl -X GET \
  "https://wowid-launcher.frostdev.io/api/manifest/latest" \
  -H "Accept: application/json" \
  -H "User-Agent: Mozilla/5.0 (compatible; WOWID3-Launcher)"
```

**Rust Implementation (updater.rs):**
```rust
let response = client
    .get(manifest_url)
    .send()
    .await
    .context("Failed to fetch manifest from URL '{}'...")?;
```

### Manifest Response Format

**Format:** JSON (RFC 8259)

**Character Encoding:** UTF-8

**Maximum Size:** Typically < 1 MB

**Schema Validation:**
```rust
let manifest: Manifest = response
    .json()
    .await
    .context("Failed to parse manifest JSON - server returned invalid JSON")?;
```

### File Download Request Format

**Type:** Standard HTTP GET request

**Range Request Support:**
```
GET /files/1.2.3/mods/mod1.jar HTTP/1.1
Range: bytes=0-1048575
```

**cURL Example:**
```bash
curl -X GET \
  "https://wowid-launcher.frostdev.io/files/1.2.3/mods/mod1.jar" \
  -o mod1.jar \
  --progress-bar
```

### File Download Response Format

**Format:** Binary stream

**Stream Implementation (download_manager.rs):**
```rust
let stream = response.bytes_stream();
while let Some(chunk) = stream.next().await {
    let chunk = chunk.context("Failed to read chunk")?;
    hasher.update(&chunk);  // Hash verification
    file.write_all(&chunk).await?;  // Write to disk
    // Send progress update
}
```

**Progress Event (Tauri):**
```rust
#[derive(Clone, Serialize)]
struct DownloadProgressEvent {
    current: usize,      // Current file number
    total: usize,        // Total files
    filename: String,    // Current file URL
    current_bytes: u64,  // Bytes downloaded so far
    total_bytes: u64,    // Total bytes to download
}
```
Emitted on every chunk received, subscribers via Tauri event system

---

## Update Check Flow

### Sequence Diagram

```
Launcher React UI
    |
    +-- useModpack.ts (checkUpdates)
            |
            +-- useTauriCommands.ts (checkForUpdates)
                    |
                    +-- Tauri Command: cmd_check_updates
                            |
                            +-- updater.rs (check_for_updates)
                                    |
                                    +-- HTTP GET /api/manifest/latest
                                            |
                                    Server responds with Manifest JSON
                                    |
                    Parse manifest
                    Return Manifest to React
            |
Compare versions:
    - Installed: stored in .wowid3-version file
    - Available: from manifest.version
    |
Check manifest hash change:
    - Calculate hash of new manifest
    - Compare with stored .wowid3-manifest-hash
    |
Update state:
    setUpdateAvailable(true/false)
```

### Update Check Polling

**File:** `wowid3-launcher/src/hooks/useModpack.ts` (lines 40-82)

**Polling Interval:** 5 minutes (300,000 ms)

**Behavior:**
1. Check on component mount
2. Then check every 5 minutes
3. Stop when component unmounts

**Manifest Change Detection:**
- Compares installed manifest hash with available manifest hash
- Even if version number hasn't changed, detects file modifications
- File: `updater.rs` (lines 86-101)

---

## Installation Flow

### Download Progress Event Sequence

```
install_modpack()
    |
    +-- Determine files to download (delta update)
    +-- Check disk space
    +-- Create DownloadManager with optimal concurrency
    +-- Create download tasks from manifest files
    |
    +-- Start parallel downloads
            |
            For each chunk received:
                +-- Emit DownloadProgress event
                    - current: files completed
                    - total: total files
                    - filename: current file URL
                    - current_bytes: total bytes downloaded
                    - total_bytes: total bytes to download
    |
    +-- Verify each file hash after completion
    +-- Clean up extra mods not in manifest
    +-- Update .wowid3-version file
    +-- Save manifest hash to .wowid3-manifest-hash
```

### Event Listener (React Side)

**File:** `wowid3-launcher/src/hooks/useModpack.ts` (lines 112-123)

```typescript
const unlisten = await listen<{
  current: number;
  total: number;
  filename: string;
  current_bytes: number;
  total_bytes: number;
}>(
  'download-progress',
  (event) => {
    setDownloadProgress(
      event.payload.current_bytes,
      event.payload.total_bytes
    );
  }
);
```

---

## Delta Update System

### File Comparison

**File:** `wowid3-launcher/src-tauri/src/modules/updater.rs` (lines 405-440)

**Algorithm:**
```
For each file in manifest:
    1. Check if file exists locally
    2. If missing: add to download list
    3. If exists:
        a. Calculate SHA-256 of local file
        b. Compare with manifest sha256
        c. If mismatch: add to download list
        d. If error calculating hash: add to download list (be safe)
    4. If matches: skip (file is up-to-date)
```

**Optimization:**
- Only downloads changed files
- Reduces bandwidth significantly on updates
- Example: 100 files, 2 modified = download 2 files only

---

## Verify & Repair System

### Integrity Check

**File:** `wowid3-launcher/src-tauri/src/modules/updater.rs` (lines 552-658)

**Flow:**
```
verify_and_repair_modpack()
    |
    +-- Get list of files that need repair
            (uses same algorithm as delta update)
    |
    +-- Re-download all corrupted/missing files
    +-- Verify hashes match manifest
    |
    +-- Update manifest hash file
```

**Use Cases:**
- User suspects modpack is corrupted
- Manual verification before playing
- Recover from interrupted installations

---

## Security Considerations

### CORS Policy

**Production:**
- Permissive CORS allows any origin to download files
- Rationale: Launcher is open-source and public
- No sensitive data served through public endpoints

**Development:**
- Can be restricted to specific origin via `CORS_ORIGIN` env var
- Useful for testing with localhost

### Path Traversal Prevention

**File:** `wowid3-server/server/src/api/public.rs` (lines 122-133)

```rust
let canonical_release = fs::canonicalize(&release_path).await?;
let canonical_file = fs::canonicalize(&full_path).await?;

if !canonical_file.starts_with(&canonical_release) {
    return Err(AppError::Forbidden("Path traversal attempt detected"));
}
```

**Protection:**
- Prevents accessing files outside release directory
- Example blocked: `../../../etc/passwd`

### Blacklist Enforcement

**File:** `wowid3-server/server/src/api/public.rs` (lines 135-146)

**Purpose:**
- Prevent distribution of user-specific data
- Exclude: save files, player data, configs

**Pattern Matching:**
- Glob patterns (e.g., `*.txt`, `config/**`)
- File: `wowid3-server/server/src/utils.rs`

**Blocked Files Example:**
```
worlddata/**          # Minecraft save data
playerdata/**         # Player profiles
screenshots/**        # User screenshots
*.txt                 # Text configs
```

### Whitelist for Java Downloads

**File:** `wowid3-server/server/src/api/public.rs` (lines 68-73)

```rust
let allowed_files = [
    "zulu21-windows-x64.zip",
    "zulu21-macos-x64.tar.gz",
    "zulu21-macos-aarch64.tar.gz",
    "zulu21-linux-x64.tar.gz",
];

if !allowed_files.contains(&filename.as_str()) {
    return Err(AppError::NotFound(...));
}
```

---

## Admin API (Not Used by Launcher)

The following admin endpoints exist but are **not used by the launcher**. They require Bearer token authentication and are for server administration only:

- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/releases` - List releases
- `POST /api/admin/releases` - Create release
- `DELETE /api/admin/releases/:version` - Delete release
- `POST /api/admin/drafts/*` - Draft management
- `PUT /api/admin/blacklist` - Manage blacklist

These are documented in the CLAUDE.md file but are not part of the launcher-server communication.

---

## Caching Strategy

### Server-Side Caching

**File:** `wowid3-server/server/src/cache.rs`

**Cached Items:**
- Manifest (latest and versioned)
- Duration: In-memory cache

**Benefits:**
- Reduces disk I/O
- Faster repeated manifest requests
- Cache invalidated on release publish

### Client-Side Caching

**Java Runtime:**
- Extracted to app cache directory
- Re-downloaded only if missing or hash mismatch
- File: `wowid3-launcher/src-tauri/src/modules/java_runtime.rs`

**Manifests:**
- Stored in Zustand store (in-memory)
- Persisted to localStorage by Zustand
- Polling interval: 5 minutes

**Version Files:**
- `.wowid3-version` - Current installed version
- `.wowid3-manifest-hash` - Hash of installed manifest

---

## Troubleshooting Guide

### Common Issues & Solutions

| Issue | Symptom | Cause | Solution |
|-------|---------|-------|----------|
| Manifest fetch fails | "Check your network connection" | Server unreachable | Verify URL, check internet |
| Downloads timeout | "Connection timeout after 300s" | Slow internet | Increase timeout in settings |
| Hash mismatch | "Checksum mismatch" | Corrupted download | Use "Verify & Repair" |
| Blacklisted file | "File access denied" | Attempting to download user data | Normal, blacklist is working |
| Concurrent download limit | Downloads stall | Too many files queued | Automatic, based on CPU cores |

---

## Environment Variables (Server)

```bash
# Server Configuration
ADMIN_PASSWORD=your-secure-password    # Admin API password
STORAGE_PATH=../storage                # File storage directory
API_PORT=8080                          # HTTP port
API_HOST=0.0.0.0                       # Bind address
CORS_ORIGIN=http://localhost:5173      # CORS origin (dev only)
BASE_URL=https://your-domain.com       # Public base URL for file downloads
```

---

## Performance Characteristics

### Typical Request Times

| Operation | Typical Time | Notes |
|-----------|--------------|-------|
| Manifest fetch | 500ms - 2s | Includes network latency |
| Small file download (< 10MB) | 1s - 10s | Depends on internet speed |
| Large file download (> 100MB) | 30s - 5m | May be resumed with retries |
| 50-file install | 2m - 30m | Parallelized, depends on file sizes |
| Concurrent connection | 15-50 | Based on CPU cores |

### Bandwidth Usage

- **Initial Install:** 2GB - 10GB (modpack size)
- **Update (delta):** 10MB - 500MB (changed files only)
- **Verify & Repair:** 0MB - 2GB (depends on corruption)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-18 | Initial API specification |

---

## References

- Server Code: `/home/user/wow-is-dead-3/wowid3-server/server/src/`
- Launcher Code: `/home/user/wow-is-dead-3/wowid3-launcher/src-tauri/src/modules/`
- Configuration: `CLAUDE.md` in project root
