# Modpack Update System - Code Reference Guide

## File Locations & Key Functions

### 1. React Frontend (TypeScript)

#### /home/user/wow-is-dead-3/wowid3-launcher/src/hooks/useModpack.ts
```
Key Functions:
├─ useModpack()                    (lines 6-192)
│  ├─ Initialization (mount)      (lines 26-37)
│  ├─ Polling loop (5 min)        (lines 40-82)
│  ├─ checkUpdates()              (lines 84-100)
│  ├─ install()                   (lines 102-141)
│  └─ verifyAndRepair()           (lines 143-179)
│
├─ Event Listener: 'download-progress' (lines 112-123, 153-164)
│  ├─ Receives progress events from Tauri
│  └─ Updates UI with download status
│
└─ Return object with:
   ├─ installedVersion
   ├─ latestManifest
   ├─ updateAvailable
   ├─ isDownloading
   ├─ downloadProgress
   ├─ error
   ├─ checkUpdates()
   ├─ install()
   └─ verifyAndRepair()
```

#### /home/user/wow-is-dead-3/wowid3-launcher/src/hooks/useTauriCommands.ts
```
Command Invocations:
├─ checkForUpdates(manifestUrl)     (line 61-62)
│  └─ invoke 'cmd_check_updates'
│
├─ getInstalledVersion(gameDir)     (line 65-66)
│  └─ invoke 'cmd_get_installed_version'
│
├─ installModpack(manifest, gameDir) (line 69-73)
│  └─ invoke 'cmd_install_modpack'
│
├─ verifyAndRepairModpack(manifest, gameDir) (line 76-80)
│  └─ invoke 'cmd_verify_and_repair_modpack'
│
└─ hasManifestChanged(manifest, gameDir) (line 83-87)
   └─ invoke 'cmd_has_manifest_changed'
```

#### /home/user/wow-is-dead-3/wowid3-launcher/src/stores/modpackStore.ts
```
State Structure:
├─ installedVersion: string | null
├─ latestManifest: Manifest | null
├─ updateAvailable: boolean
├─ isDownloading: boolean
├─ downloadProgress: {current, total} | null
└─ error: string | null

Manifest Structure:
├─ version: string
├─ minecraft_version: string
├─ fabric_loader: string
├─ changelog: string
└─ files: ModpackFile[]
   └─ ModpackFile:
      ├─ path: string
      ├─ url: string
      ├─ sha256: string
      └─ size: number
```

### 2. Rust Backend - Tauri Commands (/src-tauri/src/lib.rs)

```
Command Handlers:
├─ cmd_check_updates()           (lines 462-466)
│  └─ check_for_updates(manifest_url)
│
├─ cmd_get_installed_version()   (lines 469-473)
│  └─ get_installed_version(game_dir)
│
├─ cmd_install_modpack()         (lines 476-494)
│  ├─ install_modpack(manifest, game_dir, progress_callback)
│  └─ emit "download-progress" events
│
├─ cmd_verify_and_repair_modpack() (lines 497-515)
│  ├─ verify_and_repair_modpack(manifest, game_dir, progress_callback)
│  └─ emit "download-progress" events
│
└─ cmd_has_manifest_changed()    (lines 518-522)
   └─ has_manifest_changed(manifest, game_dir)

Progress Event:
├─ Event name: "download-progress"
├─ Payload: DownloadProgressEvent
│  ├─ current: usize (current file number)
│  ├─ total: usize (total files)
│  ├─ filename: String
│  ├─ current_bytes: u64 (bytes done)
│  └─ total_bytes: u64 (total bytes)
```

### 3. Core Update Logic (/src-tauri/src/modules/updater.rs)

```
Main Functions:
├─ check_for_updates(manifest_url)      (lines 47-84)
│  ├─ HTTP GET with 10s timeout
│  ├─ Parse JSON
│  └─ Return Manifest
│
├─ calculate_manifest_hash(manifest)    (lines 87-101)
│  ├─ Hash version string
│  ├─ Hash all file SHA-256s
│  └─ Return SHA-256 of manifest
│
├─ has_manifest_changed(manifest, game_dir) (lines 127-132)
│  ├─ Get stored hash from .wowid3-manifest-hash
│  ├─ Compare with current hash
│  └─ Return true if different
│
├─ get_files_to_download(manifest, game_dir) (lines 406-440)
│  ├─ For each file in manifest:
│  │  ├─ Check if exists
│  │  ├─ verify_file_checksum()
│  │  └─ Add to list if missing/corrupted
│  └─ Return Vec<ManifestFile>
│
├─ verify_file_checksum(file_path, expected_sha256) (lines 135-149)
│  ├─ Read file
│  ├─ Calculate SHA-256
│  └─ Return true if match
│
├─ install_modpack(manifest, game_dir, progress_callback) (lines 448-550)
│  ├─ get_files_to_download()
│  ├─ check_disk_space()
│  ├─ Create DownloadManager
│  ├─ Parallel download with progress
│  ├─ cleanup_extra_mods()
│  ├─ update_version_file()
│  ├─ save_manifest_hash()
│  └─ Return success
│
├─ verify_and_repair_modpack(manifest, game_dir, progress_callback) (lines 554-658)
│  ├─ Same as install but forced scan
│  ├─ Scans all files regardless of version
│  └─ Re-downloads corrupted/missing
│
├─ get_installed_version(game_dir)      (lines 245-256)
│  └─ Read .wowid3-version file
│
├─ update_version_file(game_dir, version) (lines 259-265)
│  └─ Write version to .wowid3-version
│
├─ cleanup_extra_mods(manifest, game_dir) (lines 269-323)
│  ├─ Scan mods/ directory
│  └─ Delete JAR files not in manifest
│
└─ check_disk_space(game_dir, required_bytes) (lines 326-403)
   ├─ Get available space
   ├─ Add 10% buffer
   └─ Return error if insufficient

Persistent Files:
├─ .wowid3-version (version string)
├─ .wowid3-manifest-hash (SHA-256 hash)
└─ mods/ (downloaded files)
```

### 4. Download Manager (/src-tauri/src/modules/download_manager.rs)

```
Main Struct:
├─ DownloadManager
│  ├─ client: Client (HTTP)
│  ├─ semaphore: Arc<Semaphore> (concurrency control)
│  └─ max_retries: u32 (3 attempts)

Functions:
├─ DownloadManager::new(max_concurrent, max_retries) (lines 57-71)
│  └─ Create with semaphore & HTTP client
│
├─ download_files(tasks, progress_tx)            (lines 194-224)
│  ├─ Sort tasks by priority
│  ├─ Stream::iter with buffer_unordered(1000)
│  ├─ Collect results
│  └─ Return on first error
│
├─ download_file(task, progress_tx)              (lines 76-123)
│  ├─ Acquire semaphore permit
│  ├─ download_attempt() in loop
│  ├─ Exponential backoff on retry: 2^attempt
│  ├─ Send completion event
│  └─ Release permit
│
├─ download_attempt(task, progress_tx)           (lines 126-191)
│  ├─ HTTP GET with streaming
│  ├─ Stream chunks to file
│  │  ├─ Update SHA-256 hash
│  │  ├─ Write chunk to disk
│  │  └─ Send progress event
│  ├─ verify_hash()
│  └─ Return success or error
│
├─ create_hasher(hash_type)                      (lines 227-232)
│  └─ Create Sha256Hasher
│
├─ verify_hash(hasher, expected, path)           (lines 235-252)
│  ├─ Compare case-insensitive
│  └─ Return error if mismatch
│
└─ calculate_optimal_concurrency()               (lines 281-292)
   ├─ 1-2 cores → 15
   ├─ 3-4 cores → 25
   ├─ 5-8 cores → 35
   └─ 9+ cores → 50

Data Types:
├─ DownloadTask
│  ├─ url: String
│  ├─ dest: PathBuf
│  ├─ expected_hash: HashType
│  ├─ priority: DownloadPriority
│  └─ size: u64
│
├─ DownloadPriority
│  ├─ High (3) - Libraries
│  ├─ Medium (2) - Assets
│  └─ Low (1) - Modpack files
│
├─ HashType
│  ├─ Sha1(String)
│  └─ Sha256(String)
│
└─ DownloadProgress
   ├─ url: String
   ├─ bytes_downloaded: u64
   ├─ total_bytes: u64
   └─ completed: bool
```

## Data Flow Summary

### Update Check Flow
```
useModpack() (React)
  ↓
checkForUpdates() (useTauriCommands)
  ↓
cmd_check_updates() (lib.rs)
  ↓
check_for_updates() (updater.rs)
  ↓
HTTP GET /manifest.json
  ↓
Parse JSON → Manifest struct
  ↓
useModpack() compares:
  ├─ version string
  └─ manifest hash
  ↓
setUpdateAvailable(true/false)
  ↓
React UI updates
```

### Install Flow
```
install() (React)
  ↓
installModpack() (useTauriCommands)
  ↓
cmd_install_modpack() (lib.rs)
  ↓
install_modpack() (updater.rs)
  ├─ get_files_to_download()
  ├─ check_disk_space()
  ├─ Create DownloadManager
  ├─ Convert to DownloadTask[]
  │
  ├─ Spawn progress aggregator task (Tokio)
  │
  ├─ DownloadManager::download_files()
  │  ├─ Sort by priority
  │  ├─ Semaphore controls concurrency
  │  ├─ Stream::iter with buffer_unordered(1000)
  │  │
  │  └─ For each task:
  │     ├─ Acquire permit
  │     ├─ download_attempt()
  │     │  ├─ Stream GET
  │     │  ├─ Chunk loop:
  │     │  │  ├─ Update hash
  │     │  │  ├─ Write file
  │     │  │  ├─ Send progress event
  │     │  │  └─ Continue
  │     │  └─ Verify hash
  │     ├─ Release permit
  │     └─ Return result
  │
  ├─ Progress aggregator accumulates:
  │  ├─ current_bytes
  │  ├─ total_bytes
  │  └─ Fires callback
  │
  ├─ callback → emit('download-progress')
  │
  ├─ cleanup_extra_mods()
  ├─ update_version_file()
  ├─ save_manifest_hash()
  │
  ↓
cmd_install_modpack() returns success
  ↓
useModpack() updates state:
  ├─ setInstalledVersion()
  ├─ setUpdateAvailable(false)
  └─ reset()
  ↓
React component updates UI
```

### Verify & Repair Flow
```
verifyAndRepair() (React)
  ↓
verifyAndRepairModpack() (useTauriCommands)
  ↓
cmd_verify_and_repair_modpack() (lib.rs)
  ↓
verify_and_repair_modpack() (updater.rs)
  ├─ check_for_updates() (fetch fresh manifest)
  ├─ get_files_to_download() (scan all files)
  │  ├─ For each file: check existence + hash
  │  └─ Collect corrupted/missing
  ├─ If empty: return success ("All verified")
  ├─ If not empty:
  │  ├─ check_disk_space()
  │  ├─ Create DownloadManager
  │  ├─ download_files() (same as install)
  │  └─ save_manifest_hash()
  ↓
Same progress flow as install
  ↓
userModpack() updates state
  ↓
React component updates UI
```

## Key Constants

```
Timeouts:
├─ Manifest fetch: 10 seconds
├─ HTTP request per file: 300 seconds (5 minutes)
├─ Connection timeout: 30 seconds
└─ Backoff delays: 2s, 4s, 8s

Retries:
├─ Max retries per file: 3 attempts
├─ Exponential backoff: 2^attempt seconds
└─ Total wait before failure: 2+4+8=14 seconds

Concurrency:
├─ Task queue buffer: up to 1000 tasks
├─ CPU-based limits: 15-50 concurrent downloads
├─ Per-host connection pool: max_concurrent
└─ Stream buffer per download: 64 KB

File Storage:
├─ Version file: .wowid3-version
├─ Manifest hash file: .wowid3-manifest-hash
└─ Download directory: game_dir/

Hashing:
├─ Manifest hash: SHA-256(version + file hashes)
├─ File hash: SHA-256 per file
└─ Case-insensitive comparison (lowercase both)
```

## Testing

### Unit Tests (updater.rs)
```
test_get_installed_version_no_file()
test_get_installed_version_with_file()
test_update_version_file()
test_verify_file_checksum_missing_file()
test_verify_file_checksum_correct()
test_verify_file_checksum_incorrect()
test_calculate_total_size()
test_get_files_to_download_all_new()
test_get_files_to_download_with_existing()
test_get_files_to_download_checksum_mismatch()
```

### Integration Tests (updater.rs)
```
test_check_for_updates_success()
test_check_for_updates_network_error()
test_check_for_updates_invalid_json()
test_download_file_success()
test_download_file_checksum_mismatch()
test_download_file_with_retry_success_on_second_attempt()
test_download_file_with_retry_fails_after_max_retries()
test_install_modpack_first_time()
test_install_modpack_delta_update()
test_install_modpack_no_updates_needed()
```

## Error Handling

### Network Errors
- Timeout (10s for manifest, 300s per file)
- Connection refused → Retry with backoff
- DNS resolution failure → Retry with backoff
- HTTP 404/500 → Return error message

### File Errors
- Missing file → Add to download queue
- Permission denied → Retry with backoff
- I/O error → Retry with backoff
- Disk full → Abort with clear message

### Hash Errors
- Checksum mismatch → Retry download
- After 3 retries → Error: "Failed after 3 attempts"

### Disk Space Errors
- Insufficient space → Abort with "Disk full" message
- Buffer calculation: total_size + 10%

## Performance Optimization

1. **Streaming Downloads**: Chunks streamed (64 KB) not buffered entirely
2. **Incremental Hashing**: SHA-256 updated per chunk
3. **Parallel Downloads**: N concurrent (determined by CPU cores)
4. **Delta Updates**: Only changed files downloaded
5. **Connection Pooling**: HTTP client reuses connections
6. **Early Termination**: First error stops remaining downloads

## File Locations Summary

| Component | Path | Purpose |
|-----------|------|---------|
| React Hook | src/hooks/useModpack.ts | Update management logic |
| Tauri Commands | src/hooks/useTauriCommands.ts | Command invocation |
| Zustand Store | src/stores/modpackStore.ts | React state |
| Tauri Handlers | src-tauri/src/lib.rs | Command handlers |
| Update Logic | src-tauri/src/modules/updater.rs | Core update system |
| Download Mgr | src-tauri/src/modules/download_manager.rs | Parallel downloads |
| Version File | {gameDir}/.wowid3-version | Persistent version |
| Hash File | {gameDir}/.wowid3-manifest-hash | Persistent manifest hash |

---

**Total System Memory Usage**: ~1.7 MB (with 25 concurrent downloads)
**Maximum Concurrency**: 50 (for 9+ core systems)
**Minimum Concurrency**: 15 (for 1-2 core systems)
**Delta Efficiency**: Up to 99% faster for single-file updates
**Retry Overhead**: Max 14 seconds per failed file (before giving up)
