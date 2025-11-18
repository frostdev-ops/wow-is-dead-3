# Audio System Fix Implementation Guide

## Fix 1: Add Audio Endpoint to Server (CRITICAL)

### Step 1.1: Update `server/src/api/public.rs`

Add this function after the `serve_java_runtime` function:

```rust
/// GET /api/assets/:filename
pub async fn serve_audio_file(
    State(state): State<PublicState>,
    Path(filename): Path<String>,
) -> Result<Response, AppError> {
    // Security: Whitelist allowed audio files
    const ALLOWED_FILES: &[&str] = &["wid3menu.mp3"];
    
    if !ALLOWED_FILES.contains(&filename.as_str()) {
        return Err(AppError::NotFound(format!("Audio file {} not found", filename)));
    }

    // Construct full file path
    let assets_path = state.config.storage_path().join("assets");
    let full_path = assets_path.join(&filename);

    // Security: Ensure the file is within the assets directory
    let canonical_assets = fs::canonicalize(&assets_path).await.map_err(|_| {
        AppError::NotFound("Assets directory not found".to_string())
    })?;

    let canonical_file = fs::canonicalize(&full_path).await.map_err(|_| {
        AppError::NotFound(format!("Audio file {} not found", filename))
    })?;

    if !canonical_file.starts_with(&canonical_assets) {
        return Err(AppError::Forbidden("Path traversal attempt detected".to_string()));
    }

    // Open and stream the file
    let file = fs::File::open(&canonical_file).await.map_err(|_| {
        AppError::NotFound(format!("Could not open file: {}", filename))
    })?;

    // Create streaming body
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Build response with proper headers
    // Cache for 24 hours since audio is stable
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "audio/mpeg")
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(body)
        .unwrap())
}
```

### Step 1.2: Update `server/src/main.rs` Router

Replace the public routes section (around line 102) with:

```rust
// Build public API router
let public_routes = Router::new()
    .route("/api/manifest/latest", get(get_latest_manifest))
    .route("/api/manifest/:version", get(get_manifest_by_version))
    .route("/api/java/:filename", get(serve_java_runtime))
    .route("/api/assets/:filename", get(serve_audio_file))  // ADD THIS LINE
    .route("/files/:version/*path", get(serve_file))
    .with_state(public_state);
```

Also import the function at the top:

```rust
use api::public::{
    get_latest_manifest, 
    get_manifest_by_version, 
    serve_file, 
    serve_java_runtime,
    serve_audio_file,  // ADD THIS
    PublicState
};
```

### Step 1.3: Update `server/nginx.conf`

Add this location block after the `/api/` location:

```nginx
# Audio assets
location /api/assets/ {
    proxy_pass http://127.0.0.1:5566;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    
    # Cache headers
    proxy_cache_valid 200 30d;
    proxy_cache_key "$scheme$request_method$host$request_uri";
}
```

### Step 1.4: Prepare Audio File Storage

```bash
# Create assets directory
mkdir -p wowid3-server/storage/assets

# Copy audio file (assuming it's in project root)
cp wid3menu.mp3 wowid3-server/storage/assets/

# Verify
ls -lh wowid3-server/storage/assets/wid3menu.mp3
# Should show: -rw-r--r-- 1 user group 26M ... wid3menu.mp3
```

### Step 1.5: Verify the Endpoint Works

```bash
# Start server
cd wowid3-server && ./start.sh

# Test endpoint (in another terminal)
curl -I https://wowid-launcher.frostdev.io/api/assets/wid3menu.mp3
# Expected: HTTP/2 200
# Headers: Content-Type: audio/mpeg, Cache-Control: public, max-age=86400

# Download full file
curl -O https://wowid-launcher.frostdev.io/api/assets/wid3menu.mp3
# Check file size
ls -lh wid3menu.mp3
# Should be ~26MB
```

---

## Fix 2: Remove Hardcoded URL (FOLLOW-UP)

### Step 2.1: Create Environment Variables

Create `wowid3-launcher/.env.example`:

```env
# Audio server configuration
VITE_AUDIO_SERVER_URL=https://wowid-launcher.frostdev.io/api/assets/wid3menu.mp3
```

For development, create `.env.local`:

```env
VITE_AUDIO_SERVER_URL=http://localhost:5173/api/assets/wid3menu.mp3
```

### Step 2.2: Update `wowid3-launcher/src/App.tsx`

Replace lines 16-17:

```typescript
// OLD:
const AUDIO_SERVER_URL = 'https://wowid-launcher.frostdev.io/assets/wid3menu.mp3';
const FALLBACK_AUDIO_URL = '/wid3menu-fallback.mp3';

// NEW:
const AUDIO_SERVER_URL = import.meta.env.VITE_AUDIO_SERVER_URL 
    || 'https://wowid-launcher.frostdev.io/api/assets/wid3menu.mp3';
const FALLBACK_AUDIO_URL = '/wid3menu-fallback.mp3';
```

### Step 2.3: Update `wowid3-launcher/vite.config.ts`

Ensure env vars are exposed:

```typescript
export default defineConfig({
  // ... other config
  define: {
    // Vite automatically exposes VITE_* env vars via import.meta.env
    // No changes needed, just ensure build uses .env files
  },
})
```

---

## Fix 3: Delete Orphaned Audio Hook

### Step 3.1: Remove `src/hooks/useAudio.ts`

```bash
# Backup first
cp wowid3-launcher/src/hooks/useAudio.ts wowid3-launcher/src/hooks/useAudio.ts.bak

# Delete
rm wowid3-launcher/src/hooks/useAudio.ts
```

### Step 3.2: Update `src/hooks/index.ts`

Remove the export:

```typescript
// OLD:
export * from './useAuth';
export * from './useAudio';  // REMOVE THIS LINE
export * from './useMinecraftInstaller';
export * from './useModpack';
export * from './useServer';
export * from './useDiscord';

// NEW:
export * from './useAuth';
export * from './useMinecraftInstaller';
export * from './useModpack';
export * from './useServer';
export * from './useDiscord';
```

---

## Fix 4: Consolidate Audio State (MAJOR)

### Step 4.1: Update `src/stores/audioStore.ts`

Replace entire file:

```typescript
import { create } from 'zustand';

export type AudioState = 'loading' | 'fallback' | 'transitioning' | 'main';
export type AudioSource = 'bundled' | 'cached' | 'streaming' | null;

interface AudioSystemState {
  // Loading state
  isLoading: boolean;
  loadingProgress: number;  // 0-100%
  audioState: AudioState;
  currentSource: AudioSource;
  
  // Playback state
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;  // 0-1
  currentTime: number;  // Playback position in seconds
  
  // Error handling
  error: string | null;
  retryCount: number;
  maxRetries: number;
  
  // Game integration
  wasPausedBeforeGame: boolean;
  
  // Action functions
  setLoading: (loading: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  setAudioState: (state: AudioState) => void;
  setCurrentSource: (source: AudioSource) => void;
  setPlaying: (playing: boolean) => void;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setError: (error: string | null) => void;
  setRetryCount: (count: number) => void;
  setWasPaused: (paused: boolean) => void;
  
  // Complex actions
  pauseForGame: () => void;
  resumeFromGame: () => void;
  reset: () => void;
}

const initialState = {
  isLoading: true,
  loadingProgress: 0,
  audioState: 'loading' as AudioState,
  currentSource: null as AudioSource,
  isPlaying: false,
  isMuted: false,
  volume: 0.3,
  currentTime: 0,
  error: null,
  retryCount: 0,
  maxRetries: 3,
  wasPausedBeforeGame: false,
};

export const useAudioStore = create<AudioSystemState>((set) => ({
  ...initialState,
  
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingProgress: (progress) => set({ loadingProgress: progress }),
  setAudioState: (state) => set({ audioState: state }),
  setCurrentSource: (source) => set({ currentSource: source }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setMuted: (muted) => set({ isMuted: muted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setError: (error) => set({ error }),
  setRetryCount: (count) => set({ retryCount: count }),
  setWasPaused: (paused) => set({ wasPausedBeforeGame: paused }),
  
  pauseForGame: () => set({
    isPlaying: false,
    wasPausedBeforeGame: true,
  }),
  
  resumeFromGame: () => set((state) => ({
    wasPausedBeforeGame: false,
    isPlaying: !state.isMuted,  // Resume only if not muted
  })),
  
  reset: () => set(initialState),
}));
```

### Step 4.2: Update `src/App.tsx` to Use Store

This is a larger change. Replace the audio initialization useEffect (around line 269) to sync with store:

```typescript
// Instead of maintaining separate state, use store
const { 
  setLoading, 
  setLoadingProgress, 
  setAudioState, 
  setCurrentSource,
  setPlaying,
  isMuted,
  audioState,
} = useAudioStore();

// When you previously set state:
// setAudioState('fallback')  ← Use this instead
// setCurrentSource('fallback') ← Track the source
```

This requires significant refactoring - consider incrementally moving logic into store over multiple commits.

---

## Fix 5: Add Download Progress Tracking (POLISH)

### Step 5.1: Update `src-tauri/src/modules/audio.rs`

Modify the download function to emit progress events:

```rust
use tauri::Emitter;

pub async fn download_and_cache_audio_with_progress(
    app_handle: &tauri::AppHandle,
    url: String,
) -> Result<String> {
    eprintln!("[Audio] Starting download from: {}", url);

    let cache_dir = get_cache_dir(app_handle)?;
    fs::create_dir_all(&cache_dir).await?;

    let audio_file = cache_dir.join("wid3menu.mp3");
    let temp_file = cache_dir.join("wid3menu.mp3.tmp");

    let mut retries = 0;
    loop {
        match download_audio_file_with_progress(&url, &temp_file, app_handle).await {
            Ok(file_size) => {
                if file_size < 1024 * 1024 || file_size > MAX_AUDIO_SIZE_BYTES {
                    let _ = fs::remove_file(&temp_file).await;
                    return Err(anyhow::anyhow!("Downloaded audio file size is invalid: {}", file_size));
                }

                fs::rename(&temp_file, &audio_file).await?;
                
                // Emit completion event
                let _ = app_handle.emit("audio-download-complete", serde_json::json!({
                    "path": audio_file.to_string_lossy(),
                    "size": file_size,
                }));
                
                return Ok(audio_file.to_string_lossy().to_string());
            }
            Err(e) => {
                retries += 1;
                if retries >= MAX_DOWNLOAD_RETRIES {
                    let _ = fs::remove_file(&temp_file).await;
                    return Err(e);
                }

                // Emit retry event
                let _ = app_handle.emit("audio-download-retry", serde_json::json!({
                    "attempt": retries,
                    "max_retries": MAX_DOWNLOAD_RETRIES,
                }));

                let delay_ms = RETRY_DELAY_MS * retries as u64;
                tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
            }
        }
    }
}

async fn download_audio_file_with_progress(
    url: &str, 
    output_path: &PathBuf,
    app_handle: &tauri::AppHandle,
) -> Result<u64> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()?;

    let response = client.get(url).send().await?;

    if !response.status().is_success() {
        anyhow::bail!("Audio download failed with HTTP {}", response.status());
    }

    let total_size = response.content_length().unwrap_or(0);
    
    // Emit download start
    let _ = app_handle.emit("audio-download-start", serde_json::json!({
        "total_size": total_size,
    }));

    let bytes = response.bytes().await?;
    let file_size = bytes.len() as u64;

    // Emit progress
    let progress = if total_size > 0 {
        (file_size as f64 / total_size as f64 * 100.0) as u32
    } else {
        100
    };
    
    let _ = app_handle.emit("audio-download-progress", serde_json::json!({
        "bytes_downloaded": file_size,
        "total_bytes": total_size,
        "progress_percent": progress,
    }));

    let mut f = fs::File::create(output_path).await?;
    f.write_all(&bytes).await?;
    f.sync_all().await?;

    Ok(file_size)
}
```

### Step 5.2: Register New Command

In `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
async fn cmd_download_and_cache_audio_with_progress(
    app: AppHandle, 
    url: String
) -> Result<String, String> {
    download_and_cache_audio_with_progress(&app, url)
        .await
        .map_err(|e| e.to_string())
}
```

Add to `.invoke_handler()`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... other commands
    cmd_download_and_cache_audio_with_progress,
    // ... rest of commands
])
```

---

## Deployment Checklist

```bash
# 1. Build and test server
cd wowid3-server
cargo build --release
./target/release/wowid3-modpack-server

# 2. Test audio endpoint
curl -I http://localhost:8080/api/assets/wid3menu.mp3

# 3. Build launcher
cd wowid3-launcher
npm run tauri build

# 4. Check built binary works
./src-tauri/target/release/wowid3-launcher

# 5. Verify audio downloads and caches
# Monitor: ~/.cache/wowid3-launcher/cache/audio/

# 6. Test in production
# Deploy server with nginx.conf changes
# Deploy launcher to users
# Monitor error logs

# 7. User testing
# Clear audio cache: Settings > Clear Cache
# Restart launcher
# Verify crossfade transition occurs
# Check audio quality improvement (should be noticeably better)
```

---

## Rollback Plan (If Issues Arise)

```bash
# If endpoint causes 500 errors:
# 1. Remove route from server/src/main.rs
# 2. Comment out serve_audio_file() in public.rs
# 3. Rebuild: cargo build --release
# 4. Restart server
# Fallback will activate automatically

# If audio doesn't play at all:
# 1. Check network: curl -v https://.../api/assets/wid3menu.mp3
# 2. Check file exists: ls -l storage/assets/wid3menu.mp3
# 3. Check permissions: chmod 644 storage/assets/wid3menu.mp3
# 4. Check nginx: sudo tail -f /var/log/nginx/error.log
# 5. Check app logs: journalctl -u wowid3-launcher -f
```

---

## Testing Scenarios

### Scenario 1: Normal Download (Good Connection)

```
1. Delete cache: rm -rf ~/.cache/wowid3-launcher
2. Open launcher
3. Fallback plays immediately (100ms)
4. Watch network tab: 26MB downloads over 30-60 seconds
5. See progress in console: [Audio] Download successful
6. Fallback fades out, main audio fades in (2 second transition)
7. Main audio continues looping
```

### Scenario 2: Cached Audio (Restart)

```
1. Close launcher
2. Wait 5 seconds
3. Reopen launcher
4. No download occurs (check network tab)
5. Cached audio loads immediately (still has 100ms startup delay)
6. Fallback plays anyway but is quickly replaced
7. Main audio starts from cache
```

### Scenario 3: Network Timeout (Simulate)

```
1. Clear cache
2. Disconnect network OR block in firewall
3. Open launcher
4. Fallback plays immediately
5. Download attempt fails
6. Retry 1 fails, retry 2 fails, retry 3 fails
7. App stays on fallback indefinitely
8. Console shows: [Audio] Download failed after 3 retries
9. Reconnect network (if testing)
10. Manual retry (not yet implemented) would start download again
```

---

## Success Metrics

After implementing all fixes:

- Launcher starts with audio within 500ms
- Fallback preview plays within 100ms  
- Main audio downloads in background (non-blocking)
- Crossfade transition smooth and nearly imperceptible
- Audio cache persists across restarts
- No console errors related to audio
- Full-quality 26MB audio plays instead of 705KB preview
- Users report much better audio experience
- Retry mechanism handles network issues gracefully
- No resource leaks or memory issues

