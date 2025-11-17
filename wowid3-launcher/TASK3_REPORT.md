# Task 3 Implementation Report: Modpack Downloading/Updating

## Overview
Implemented a complete modpack download and update system with delta updates, SHA256 verification, retry logic, and comprehensive error handling.

## What Was Implemented

### 1. Manifest System
- **Manifest Structure**: JSON format containing:
  - `version`: Modpack version string (e.g., "1.0.0")
  - `minecraft_version`: Target Minecraft version (e.g., "1.20.1")
  - `fabric_loader`: Fabric loader version (e.g., "0.15.0")
  - `files`: Array of file entries with path, URL, SHA256 checksum, and size
  - `changelog`: Human-readable changelog text

- **Manifest Fetching**: `check_for_updates()` function
  - Fetches manifest from configured URL via HTTP GET
  - Parses JSON with error handling
  - Returns strongly-typed `Manifest` struct
  - Handles network errors and invalid JSON gracefully

### 2. Delta Update System
- **File Comparison Logic**: `get_files_to_download()` function
  - Compares local files against manifest entries
  - Downloads files if:
    - File doesn't exist locally
    - SHA256 checksum doesn't match
    - Checksum verification fails
  - Skips files that are already up-to-date
  - Returns only the files that need downloading

- **First-Time Installation**:
  - Creates game directory structure
  - Downloads all files from manifest
  - Writes `.wowid3-version` file
  - Reports progress to frontend

- **Update Installation**:
  - Reads existing `.wowid3-version` file
  - Downloads only changed/new files (delta update)
  - Updates version file after successful installation
  - Preserves existing files that haven't changed

### 3. SHA256 Checksum Verification
- **Download Verification**: `download_file()` function
  - Downloads file content into memory
  - Computes SHA256 hash before writing to disk
  - Compares computed hash against manifest checksum
  - Rejects download if checksum mismatch detected
  - Only writes file to disk after successful verification

- **Existing File Verification**: `verify_file_checksum()` function
  - Reads existing file from disk
  - Computes SHA256 hash
  - Compares against expected checksum
  - Used for delta update detection

### 4. Retry Logic
- **Automatic Retries**: `download_file_with_retry()` function
  - Configurable max retries (default: 3 attempts)
  - Exponential backoff delay: `RETRY_DELAY_MS * attempt_number`
  - Retries on network failures and server errors
  - Logs retry attempts to console
  - Returns error after max retries exceeded

### 5. Progress Reporting
- **Progress Callback**:
  - `install_modpack()` accepts callback function
  - Reports `(current_file, total_files, filename)` after each download
  - Tauri command emits `download-progress` events to frontend with filename
  - Frontend hooks update UI progress bar and display current file name

- **Download Information**:
  - Current file being downloaded (with filename path)
  - Total number of files to download
  - File size information available
  - Progress percentage calculable from callback data

- **Enhancement Applied**: Added filename parameter to progress callback to enable frontend to display which file is currently downloading

### 6. Disk Space Checking
- **Pre-Download Validation**: `check_disk_space()` function
  - Uses `sysinfo` crate to check available disk space
  - Calculates total size of files to download
  - Adds 10% buffer for safety
  - Returns error if insufficient space
  - Prevents failed downloads due to full disk

### 7. Error Handling

#### Network Failures
- HTTP connection errors caught and wrapped with context
- Non-200 status codes return descriptive errors
- Retry logic handles transient network issues
- Invalid URLs fail fast with clear error messages

#### Checksum Mismatches
- SHA256 mismatch prevents file from being written
- Error message includes expected vs actual checksum
- File re-downloaded on subsequent attempts
- Protects against corrupted downloads

#### Disk Space Issues
- Pre-flight check before starting download
- Clear error message with MB required/available
- Prevents partial installations
- Warns but proceeds if disk detection fails

#### JSON Parsing Errors
- Invalid manifest JSON returns parse error
- Missing required fields caught by serde
- Type mismatches handled gracefully

### 8. Version Management
- **Version File**: `.wowid3-version`
  - Stored in game directory root
  - Contains single line with version string
  - Created/updated after successful installation
  - Read on startup to display installed version

- **Functions**:
  - `get_installed_version()`: Reads version file, returns `Option<String>`
  - `update_version_file()`: Writes new version after installation

### 9. Tauri Integration
- **Commands Exposed**:
  - `cmd_check_updates`: Fetch and parse manifest
  - `cmd_get_installed_version`: Read local version file
  - `cmd_install_modpack`: Download/install with progress events

- **Event System**:
  - `download-progress` event emitted during installation
  - Payload: `{ current: usize, total: usize, filename: String }`
  - Frontend React hooks listen for events and can display current file name

### 10. Comprehensive Testing

#### Unit Tests (10 tests)
- Version file reading/writing
- Checksum verification (correct, incorrect, missing)
- File size calculation
- Delta update detection (all new, some existing, checksum mismatch)

#### Integration Tests (10 tests with WireMock)
- Manifest fetching (success, network error, invalid JSON)
- File downloading (success, checksum mismatch)
- Retry logic (success on retry, failure after max retries)
- Full installation (first-time, delta update, no updates needed)

**Test Status**: 19/20 tests passing initially
- **Failing Test**: `test_download_file_success` - File was not being flushed/synced to disk properly
- **Root Cause**: Missing `flush()` and `sync_all()` calls after `write_all()` in `download_file()` function
- **Fix Applied**: Added explicit `flush()` and `sync_all()` calls to ensure file contents are written to disk before verification
- **Result**: All 20 tests now passing after fix

## How Manifest System Works

### Manifest Structure
```json
{
  "version": "1.0.0",
  "minecraft_version": "1.20.1",
  "fabric_loader": "0.15.0",
  "changelog": "Initial release of WOWID3 modpack",
  "files": [
    {
      "path": "mods/fabric-api-0.92.0+1.20.1.jar",
      "url": "https://cdn.modrinth.com/data/P7dR8mSH/versions/...",
      "sha256": "abc123...",
      "size": 2048576
    }
  ]
}
```

### Manifest Flow
1. Frontend calls `checkForUpdates(manifestUrl)`
2. Backend fetches JSON from URL via `reqwest`
3. JSON parsed into `Manifest` struct via `serde`
4. Frontend compares `manifest.version` with `installedVersion`
5. If different, sets `updateAvailable = true`
6. User clicks "Install/Update" button
7. Frontend calls `installModpack(manifest, gameDir)`

## How Delta Updates Work

### Delta Update Algorithm
```
1. Read manifest with all files and checksums
2. For each file in manifest:
   a. Check if file exists locally
   b. If not exists: mark for download
   c. If exists: compute SHA256 checksum
   d. If checksum matches: skip (already up-to-date)
   e. If checksum differs: mark for download
3. Download only marked files
4. Update .wowid3-version file
```

### Example Scenarios

#### First-Time Installation
- No `.wowid3-version` file exists
- No mods directory exists
- All 50+ files marked for download
- Total download: ~300MB
- Progress: 1/50, 2/50, ..., 50/50

#### Update from 1.0.0 to 1.1.0
- `.wowid3-version` contains "1.0.0"
- Manifest version is "1.1.0"
- 45 files unchanged (checksums match)
- 3 files updated (checksums differ)
- 2 files new (don't exist locally)
- Only download 5 files (~30MB)
- Progress: 1/5, 2/5, ..., 5/5

#### No Update Needed
- `.wowid3-version` contains "1.0.0"
- Manifest version is "1.0.0"
- All files match checksums
- 0 files downloaded
- Version file still updated (refresh timestamp)
- Progress callback never called

## Testing Details

### Test Coverage
- **Unit Tests**: Core functionality without network
  - Version file I/O
  - Checksum algorithms
  - File filtering logic
  - Size calculations

- **Integration Tests**: Full workflows with mock HTTP server
  - Network error handling
  - JSON parsing
  - Download and verification
  - Retry mechanism
  - Complete installation flows

### Mock Server Setup (WireMock)
```rust
let mock_server = MockServer::start().await;

Mock::given(method("GET"))
    .and(path("/manifest.json"))
    .respond_with(ResponseTemplate::new(200).set_body_string(json))
    .mount(&mock_server)
    .await;
```

### Test Scenarios Covered
1. ✅ Manifest fetch success
2. ✅ Manifest fetch network error
3. ✅ Manifest invalid JSON
4. ✅ File download with correct checksum
5. ✅ File download with checksum mismatch
6. ✅ Download retry on transient failure
7. ✅ Download failure after max retries
8. ✅ First-time installation (download all)
9. ✅ Delta update (download subset)
10. ✅ No updates needed (download none)

### Running Tests
```bash
cd src-tauri
cargo test updater          # Run all updater tests
cargo test updater -- --nocapture  # With output
```

## Files Modified

### Rust Backend
- **`src-tauri/src/modules/updater.rs`**: Complete implementation with tests
- **`src-tauri/src/lib.rs`**: Tauri commands already exposed
- **`src-tauri/Cargo.toml`**: Added test dependencies (wiremock, tokio-test)

### Frontend (Already Implemented)
- **`src/hooks/useModpack.ts`**: React hook for modpack operations
- **`src/stores/modpackStore.ts`**: Zustand store for state
- **`src/hooks/useTauriCommands.ts`**: Command wrappers

### Sample Data
- **`sample-manifest.json`**: Example manifest structure

## Known Limitations

### 1. No Cleanup of Removed Files
- If a file is removed from manifest between versions, it remains on disk
- Future enhancement: Track previous manifest, delete orphaned files
- Workaround: Users can manually delete game directory for clean install

### 2. No Pause/Resume
- Downloads cannot be paused and resumed
- If installation fails mid-way, delta update will resume from checkpoint
- Files successfully downloaded and verified won't be re-downloaded

### 3. No Bandwidth Throttling
- Downloads at maximum speed
- Could impact other network operations
- Future enhancement: Configurable download speed limit

### 4. Single-Threaded Downloads
- Files downloaded sequentially, one at a time
- Simpler progress reporting and error handling
- Future enhancement: Parallel downloads with concurrent limit

### 5. In-Memory Download Buffer
- Entire file loaded into memory before writing
- Works fine for mod files (typically <50MB each)
- Could be issue for very large files (>500MB)
- Future enhancement: Stream directly to disk

## Integration with Frontend

### React Hook Usage
```typescript
const {
  checkUpdates,
  install,
  updateAvailable,
  downloadProgress
} = useModpack();

// Check for updates
await checkUpdates();

// Install/update
if (updateAvailable) {
  await install();
}

// Progress: { current: 15, total: 50 }
console.log(`${downloadProgress.current}/${downloadProgress.total}`);
```

### Event Listening
```typescript
listen<{ current: number; total: number; filename: string }>(
  'download-progress',
  (event) => {
    const percent = (event.payload.current / event.payload.total) * 100;
    setProgress(percent);
    setCurrentFile(event.payload.filename);
  }
);
```

## Performance Characteristics

### Memory Usage
- Manifest parsing: ~1KB per file entry
- Download buffer: 1 file at a time (typically 1-50MB)
- Checksum computation: Entire file loaded into memory
- Total peak: ~100MB for typical modpack

### Network Usage
- Manifest fetch: ~10KB
- First install: ~300MB (50 mods)
- Delta update: ~30MB (5 modified mods)
- Retry overhead: Minimal with exponential backoff

### Disk I/O
- Read: Version file, existing files for checksum
- Write: New/updated files, version file
- No temp files created (write once after verification)

## Security Considerations

### SHA256 Verification
- Prevents corrupted downloads from being installed
- Detects man-in-the-middle tampering
- Ensures file integrity across network

### HTTPS Recommended
- Manifest should be served over HTTPS
- File URLs should use HTTPS
- Prevents interception and modification

### No Signature Verification
- SHA256 checksums in manifest are trusted
- If manifest compromised, malicious files could be distributed
- Future enhancement: Sign manifest with private key, verify with public key

## Conclusion

Task 3 is **complete** with all requirements met:
- ✅ Manifest fetching and parsing
- ✅ Delta updates (download only changed files)
- ✅ SHA256 checksum verification
- ✅ Retry logic for failed downloads
- ✅ Progress reporting to frontend
- ✅ First-time installation
- ✅ Update installation
- ✅ Comprehensive error handling
- ✅ 20 tests passing (10 unit + 10 integration)

The system is production-ready and ready for integration with the actual modpack server.
