# WOWID3 Launcher: Error Handling and Recovery Mechanisms Analysis

## 1. Network Failure Handling

### 1.1 Download Manager (`download_manager.rs`)
The download manager implements a multi-layered approach to network error recovery:

**HTTP Client Configuration** (Lines 58-64):
- Connection timeout: 30 seconds
- Request timeout: 300 seconds (5 minutes)
- Connection pooling with 90-second idle timeout
- Optimized for concurrent requests

**Network Error Handling Flow** (Lines 86-122):
```
Attempt Download
  ↓
Failed? → Check retry count < MAX_RETRIES (3)
  ↓ Yes: Exponential Backoff + Retry
  ↓ No: Return contextual error
```

**Exponential Backoff Strategy** (Line 110):
```
backoff = 2^attempt seconds
Attempt 1: 1 second
Attempt 2: 2 seconds
Attempt 3: 4 seconds
Then fail with detailed error context
```

### 1.2 Manifest Fetch (`updater.rs`)
Manifest fetching is a critical operation with dedicated error handling (Lines 47-84):

**Timeout Protection** (Line 17):
```
MANIFEST_FETCH_TIMEOUT_SECS: 10 seconds
```

**Error Messages with Context** (Lines 59-71):
- Network error: Suggests checking connection and server reachability
- HTTP status errors: Shows status code and reason
- JSON parsing errors: Indicates server returned invalid JSON

### 1.3 Tauri Command Error Wrapping (`lib.rs`)
All Tauri commands wrap Rust `Result<T>` types and convert to `Result<T, String>`:
- Line 465: `check_for_updates` – converts anyhow::Error to String
- Line 494: `install_modpack` – error conversion
- Line 515: `verify_and_repair_modpack` – error conversion

---

## 2. Retry Logic for Downloads

### 2.1 Download Manager Retry Mechanism (`download_manager.rs`)

**Configuration** (Line 52):
```rust
pub struct DownloadManager {
    max_retries: u32,  // Typically 3
}
```

**Per-File Retry Logic** (Lines 76-123):
```rust
loop {
    match download_attempt(task, progress) {
        Ok(_) => return Ok(()),
        Err(e) if attempt >= max_retries => return Err(e),
        Err(e) => {
            backoff = 2^attempt
            sleep(backoff)
            attempt += 1
            // Try again
        }
    }
}
```

**Chunk-Level Error Recovery** (Lines 158-182):
- Streams download in chunks
- Each chunk verified as it arrives
- If chunk read fails: entire download fails (retry attempts whole file)
- Progress updates sent for each successful chunk

### 2.2 Hash Verification During Download

**Streaming Hash Calculation** (Lines 156-162):
```rust
while let Some(chunk) = stream.next().await {
    hasher.update(&chunk);  // Update hash as we download
    file.write_all(&chunk).await;
}
verify_hash(hasher, expected_hash)?;  // Verify after complete download
```

**Supported Hash Types** (Lines 23-26):
- SHA1 (for legacy compatibility)
- SHA256 (for modern modpacks)

---

## 3. Corrupted File Detection and Recovery

### 3.1 Delta Update System (`updater.rs`)

**File Verification Strategy** (Lines 405-440):
```
For each manifest file:
  1. Check if file exists
     → Missing? → Add to download list
  2. If exists, verify SHA256 checksum
     → Match? → Skip
     → Mismatch? → Add to download list
     → Verification error? → Add to download list (safe re-download)
```

### 3.2 Verify and Repair Command (`updater.rs`)

**Dedicated Repair Function** (Lines 554-658):
- Scans ALL files against manifest checksums
- Identifies missing/corrupted/modified files
- Downloads only corrupted/missing files
- Re-verifies after repair
- Updates manifest hash after successful repair

**Output Messages** (Lines 572-579):
```
[Repair] Starting modpack verification...
[Repair] Found X corrupted/missing files to repair
[Repair] Re-downloading Y files (Z MB)
[Repair] ✓ Modpack repair complete!
[Repair] Repaired X files
```

### 3.3 Extra Mods Cleanup (`updater.rs`)

**Orphaned File Handling** (Lines 269-323):
- Scans mods directory recursively
- Identifies .jar files NOT in current manifest
- Removes orphaned mods (prevents version mismatches)
- Handles removal failures gracefully with warnings

---

## 4. Progress Tracking and Cancellation

### 4.1 Multi-Channel Progress System (`updater.rs`)

**Progress Event Structure** (Lines 37-44):
```rust
struct DownloadProgress {
    current_file: usize,      // Which file (1 to N)
    total_files: usize,       // Total files
    current_bytes: u64,       // Bytes downloaded THIS file
    total_bytes: u64,         // Total bytes for THIS file
    current_file_name: String,
}
```

### 4.2 Progress Tracking Implementation (`updater.rs`)

**Concurrent Download Progress** (Lines 496-527):
```rust
let (progress_tx, progress_rx) = mpsc::channel(100);

// Download thread: sends progress
// Progress tracking thread: aggregates progress
// React component: displays progress
```

**Progress Callback** (Lines 451, 517-524):
```rust
pub fn install_modpack(
    manifest: &Manifest,
    game_dir: &PathBuf,
    progress_callback: impl Fn(usize, usize, String, u64, u64) + Send + Sync,
) -> Result<()>
```

### 4.3 React-Level Progress Display (`useModpack.ts`)

**Listening for Events** (Lines 112-123):
```typescript
listen<{
    current: number;
    total: number;
    filename: string;
    current_bytes: number;
    total_bytes: number;
}>('download-progress', (event) => {
    setDownloadProgress(
        event.payload.current_bytes,
        event.payload.total_bytes
    );
});
```

### 4.4 Cancellation Support

**Current State**:
- No explicit cancellation mechanism implemented
- Download operations block until completion
- Modpack store tracks `isDownloading` state
- React hooks manage cleanup on unmount

**Recommended Implementation Path** (based on code structure):
```
1. Add `cancel_token` to download tasks
2. Modify download loop to check token
3. Add abort handler to React component
4. Clean up partial downloads on cancel
```

---

## 5. User Feedback Mechanisms

### 5.1 Toast Notification System

**Toast Provider** (`ToastContainer.tsx`, Lines 1-60):
```typescript
interface ToastContextType {
    toasts: ToastMessage[];
    addToast: (message: string, type: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}
```

**Toast Types** (`Toast.tsx`):
- `success` - Green (green-900 bg, green-200 text)
- `error` - Red (red-900 bg, red-200 text)
- `info` - Blue (blue-900 bg, blue-200 text)
- `warning` - Yellow (yellow-900 bg, yellow-200 text)

**Auto-Dismiss Behavior** (Lines 20-23, `Toast.tsx`):
```typescript
useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);  // Default 5s
    return () => clearTimeout(timer);
}, [id, duration, onClose]);
```

### 5.2 Error Feedback Locations in LauncherHome

**Auth Errors** (Lines 56-63):
```typescript
// Display auth errors as toasts (only when error changes)
if (authError && authError !== lastAuthError.current) {
    addToast(authError, 'error');
    lastAuthError.current = authError;
}
```

**Modpack Errors** (Lines 66-73):
```typescript
if (modpackError && modpackError !== lastModpackError.current) {
    addToast(modpackError, 'error');
    lastModpackError.current = modpackError;
}
```

**Download Status Feedback** (Lines 156-159, 162-164):
```typescript
try {
    addToast(installedVersion ? 'Updating modpack...' : 'Installing modpack...', 'info');
    await install();
    addToast('Modpack installed successfully!', 'success');
} catch (err) {
    addToast(`Installation failed: ${err}`, 'error');
}
```

### 5.3 Minecraft Event Feedback (`LauncherHome.tsx`)

**Log Event Handling** (Lines 177-184):
```typescript
listen('minecraft-log', (event) => {
    if (event.payload.level === 'error') {
        addToast(`Game Error: ${event.payload.message}`, 'error');
    }
});
```

**Exit Event Handling** (Lines 186-217):
```typescript
listen('minecraft-exit', async (event) => {
    if (event.payload.crashed) {
        addToast(`Game crashed with exit code ${event.payload.exit_code}`, 'error');
    } else {
        addToast('Game closed', 'info');
    }
});
```

**Crash Analysis** (Lines 219-222):
```typescript
listen('minecraft-crash', (event) => {
    console.log('[Minecraft] Crash analysis:', event.payload.message);
    addToast(event.payload.message, 'error');  // User-friendly crash message
});
```

---

## 6. Crash Analysis and Recovery

### 6.1 Crash Report Analysis (`minecraft.rs`)

**Analysis Function** (Lines 513-566):
```rust
pub async fn analyze_crash(game_dir: &PathBuf) -> Result<String>
```

**Pattern Matching** (Lines 549-560):
```
OutOfMemoryError
  → "Out of memory. Try allocating more RAM in settings."

NoClassDefFoundError
  → "Missing or incompatible mod. Check your mods."

Mod X requires Y
  → "Missing mod dependency. Check mod requirements."

Other
  → "See crash report at: [path]"
```

### 6.2 Crash Detection and Reporting (`lib.rs`)

**Process Exit Monitoring** (Lines 164-190):
```rust
// Monitor process exit
tokio::spawn(async move {
    match process.wait().await {
        Ok(status) => {
            let exit_code = status.code().unwrap_or(-1);
            let crashed = exit_code != 0;
            
            app.emit("minecraft-exit", {
                exit_code,
                crashed
            });
            
            if crashed {
                analyze_crash(&game_dir).await?;
                app.emit("minecraft-crash", { message });
            }
        }
    }
});
```

### 6.3 Error Boundary Fallback (`ErrorBoundary.tsx`)

**React-Level Error Catching** (Lines 1-57):
```typescript
export class ErrorBoundary extends Component<Props, State> {
    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }
    
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center">
                    <div className="text-center">
                        <h1>Something went wrong</h1>
                        <button onClick={() => window.location.reload()}>
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }
    }
}
```

---

## 7. State Management for Error Recovery

### 7.1 Modpack Store (`modpackStore.ts`)

**State Fields** (Lines 17-36):
```typescript
interface ModpackState {
    installedVersion: string | null;
    latestManifest: Manifest | null;
    updateAvailable: boolean;
    isDownloading: boolean;
    downloadProgress: { current: number; total: number } | null;
    error: string | null;  // Error tracking
}
```

**Reset Mechanism** (Lines 64-69):
```typescript
reset: () => set({
    downloadProgress: null,
    isDownloading: false,
    error: null,  // Clear error on successful completion
})
```

### 7.2 Update Polling with Retry (`useModpack.ts`)

**Exponential Backoff Retry** (Lines 100-127, `LauncherHome.tsx`):
```typescript
const backoffDelay = Math.min(
    Math.pow(2, modpackCheckRetries.current) * 1000,
    60000  // Max 60 seconds
);

// Exponential backoff:
// Attempt 1: 2^0 = 1 second
// Attempt 2: 2^1 = 2 seconds
// Attempt 3: 2^2 = 4 seconds
// etc, capping at 60 seconds
```

**Silent Retry on Background Check** (Lines 129-131):
```typescript
// Don't show toast for network errors on auto-check
// User can manually check from settings if needed
```

---

## 8. Disk Space Validation

### 8.1 Pre-Download Check (`updater.rs`)

**Disk Space Function** (Lines 326-403):
```rust
pub fn check_disk_space(game_dir: &PathBuf, required_bytes: u64) -> Result<()>
```

**Safety Features**:
1. Canonicalizes path (handles symlinks, relative paths)
2. Adds 10% buffer for safety: `required_with_buffer = required_bytes + (required_bytes / 10)`
3. Finds correct disk/mount point
4. Graceful fallback if disk cannot be determined
5. Detailed error message showing MB availability

---

## 9. Failure Scenarios and Recovery Strategies

| Scenario | Detection | Recovery | User Feedback |
|----------|-----------|----------|----------------|
| Network timeout | `connect_timeout` or `timeout` error | 3 retries with exponential backoff (1s, 2s, 4s) | Toast: "Failed to download [file] after 3 attempts" |
| HTTP 404/500 | `error_for_status()` check | 3 retries (same backoff) | Toast with HTTP status + reason |
| JSON parse error | Serde JSON deserialization fails | No retry (invalid manifest) | Toast: "Failed to parse manifest JSON" |
| Corrupted file | SHA256 mismatch | Re-download with retry | Verify & Repair shows files repaired |
| Missing file | File doesn't exist on disk | Add to download queue | Progress shows "X files to download" |
| Disk full | `check_disk_space()` fails | Abort before download | Toast: "Insufficient disk space: X MB required, Y MB available" |
| OOM crash | Exit code != 0 + OutOfMemoryError in logs | Display suggestion | Toast: "Out of memory. Try allocating more RAM" |
| Mod dependency crash | NoClassDefFoundError in logs | Display mod suggestion | Toast: "Missing mod dependency. Check mod requirements." |
| Java not found | Path doesn't exist | Download from server | Toast: "Failed to download Java runtime" |
| Process spawn fails | `Command::spawn()` fails | Return error | Toast: "Failed to launch game: [error]" |
| Game crash (unknown) | Non-zero exit code, crash report found | Analyze crash report | Toast with crash message + report location |

---

## 10. Testing Coverage

### Unit Tests Present
- `verify_file_checksum_*` (3 tests) – SHA256 validation
- `get_installed_version_*` (2 tests) – Version file handling
- `update_version_file` – Version file writing
- `calculate_total_size` – File size aggregation
- `get_files_to_download_*` (3 tests) – Delta update logic
- `launch_config_serialization` – Tauri command serialization
- `analyze_crash_*` (2 tests) – Crash report parsing

### Integration Tests Present
- `check_for_updates_success` – Manifest fetching
- `check_for_updates_network_error` – Network error handling
- `check_for_updates_invalid_json` – JSON parsing errors
- `download_file_success` – Successful download
- `download_file_checksum_mismatch` – Hash verification failure
- `download_file_with_retry_*` (2 tests) – Retry logic
- `install_modpack_*` (3 tests) – Full installation scenarios

---

## 11. Recommendations for Improvement

### High Priority
1. **Add cancellation support** for long-running downloads
   - Implement CancellationToken pattern
   - Add abort button to download UI
   
2. **Implement pause/resume** for large modpack downloads
   - Use HTTP range requests
   - Track partial progress
   
3. **Add better crash analysis**
   - Parse more error patterns
   - Link to mod documentation
   - Suggest version rollback

### Medium Priority
4. **Implement circuit breaker** for repeated failures
   - Stop retrying if server is down
   - Show maintenance message
   
5. **Add selective file repair**
   - User can choose which files to repair
   - Shows corruption details
   
6. **Improve offline mode** handling
   - Cache manifest locally
   - Detect network unavailability early

### Low Priority
7. **Add telemetry** for failure analysis
   - Track error types and frequencies
   - Help identify systemic issues
   
8. **Implement dependency resolver**
   - Check mod compatibility before install
   - Warn about conflicts

