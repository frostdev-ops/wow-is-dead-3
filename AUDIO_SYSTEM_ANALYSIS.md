# WOWID3 Music Streaming System Analysis

## Executive Summary

The music streaming system is **partially non-functional** due to a critical missing server endpoint. The launcher expects audio to be downloaded from `https://wowid-launcher.frostdev.io/assets/wid3menu.mp3`, but this endpoint is never implemented on the server. The application has fallback mechanisms and local caching, but the primary streaming system is broken.

---

## 1. How Audio Is Supposed To Be Loaded and Played

### Architecture Overview

The system uses a **tiered audio strategy**:

```
User Opens App
    ↓
Fallback Audio (bundled 705KB preview)
    ↓
[Parallel] Main Audio Download (26MB from server)
    ↓
Crossfade Transition
    ↓
Main Audio (cached for future sessions)
```

### File Sizes
- **wid3menu.mp3** (26MB) - Main full-length music, stored in app root
- **wid3menu-fallback.mp3** (705KB) - Short preview, served via public static files

### Loading Flow (as designed)

1. **App Initialization** (App.tsx:269-302)
   - Starts fallback audio immediately (small size, instant playback)
   - Launches background download of main audio (non-blocking)

2. **Fallback Phase**
   ```typescript
   // App.tsx:274-284
   const fallbackTimer = setTimeout(() => {
     if (fallbackRef.current && audioState === 'loading') {
       fallbackRef.current.volume = 0.3;
       fallbackRef.current.play()
         .then(() => setAudioState('fallback'))
         .catch(err => console.log('[Audio] Failed to start fallback audio:', err));
     }
   }, 100);
   ```

3. **Background Download** (App.tsx:140-207)
   ```typescript
   const loadMainAudio = async () => {
     // Step 1: Check for cached audio bytes
     const cachedBytes = await invoke<number[]>('cmd_read_cached_audio_bytes');
     
     if (cachedBytes) {
       // Convert to Blob and load from cache
       const byteArray = new Uint8Array(cachedBytes);
       const blob = new Blob([byteArray], { type: 'audio/mpeg' });
       mainRef.current.src = URL.createObjectURL(blob);
     } else {
       // Download from server
       const downloadedPath = await invoke<string>('cmd_download_and_cache_audio', {
         url: AUDIO_SERVER_URL,
       });
       // Re-read as bytes and load
     }
   };
   ```

4. **Crossfade Transition** (App.tsx:42-137)
   - Waits for main audio to load (`onloadeddata` event)
   - Fades out fallback (0.3 → 0 over 2 seconds)
   - Fades in main (0 → 0.3 over 2 seconds)
   - Continues looping main audio

### Key Parameters

| Component | Value | Purpose |
|-----------|-------|---------|
| Fallback Volume | 0.3 (30%) | Balanced audio while waiting |
| Main Volume | 0.3 (30%) | Consistent with fallback |
| Max Audio Size | 50 MB | File validation limit |
| Min Audio Size | 1 MB | Corruption detection |
| Download Retries | 3 | Network reliability |
| Load Timeout | 10 seconds | Prevent hanging on bad downloads |
| Stuck Timeout | 15 seconds | Fallback monitoring |
| Max Retries | 3 | Total attempts before giving up |

---

## 2. What API Endpoints Should Serve Music Files

### Current Implementation (BROKEN)

**Expected Endpoint:**
```
GET /assets/wid3menu.mp3
```

**Full URL in Launcher:**
```
https://wowid-launcher.frostdev.io/assets/wid3menu.mp3
```

### Server Routing Analysis

**Actual Server Routes (from server/src/main.rs:101-107):**

```rust
let public_routes = Router::new()
    .route("/api/manifest/latest", get(get_latest_manifest))
    .route("/api/manifest/:version", get(get_manifest_by_version))
    .route("/api/java/:filename", get(serve_java_runtime))
    .route("/files/:version/*path", get(serve_file))
    .with_state(public_state);
```

**Missing:** Any route for `/assets/` or `/api/assets/`

### Nginx Configuration (server/nginx.conf)

```nginx
location /files/ {
    proxy_pass http://127.0.0.1:5566;  # File serving proxy
}

location /api/ {
    proxy_pass http://127.0.0.1:5566;  # API proxy
}

# No /assets/ location defined
```

---

## 3. Why It's Currently Not Working

### Critical Issues

#### Issue #1: Missing Server Endpoint (BLOCKING)
- **Problem:** Launcher hardcodes `https://wowid-launcher.frostdev.io/assets/wid3menu.mp3`
- **Server Response:** 404 Not Found (nginx returns admin panel index.html fallback)
- **Impact:** Download fails immediately, falls back to 705KB preview forever
- **Location:** 
  - Hardcoded in: `/home/user/wow-is-dead-3/wowid3-launcher/src/App.tsx:16`
  - Invoked from: `App.tsx:205`

#### Issue #2: Unused Hook (Audio Management)
- **File:** `/home/user/wow-is-dead-3/wowid3-launcher/src/hooks/useAudio.ts`
- **Status:** Completely unused/deprecated
- **Evidence:** 
  - Not imported in App.tsx
  - Only imported in `hooks/index.ts` (which is also not imported by App.tsx)
  - useAudio.ts defines old command interfaces like `cmd_get_cached_audio`

#### Issue #3: Incomplete Audio Store
- **File:** `/home/user/wow-is-dead-3/wowid3-launcher/src/stores/audioStore.ts`
- **Problems:**
  - Only manages `isMuted` and `wasPaused` flags
  - No loading state, no error tracking, no source tracking
  - Doesn't coordinate with actual audio state (App.tsx maintains its own state)
  - Inconsistent with the complex state machine in App.tsx

#### Issue #4: Duplicated Audio Logic
- **useAudio.ts:** Full implementation with hook-based state
- **App.tsx:** Reimplemented audio logic with different approach
- **Problem:** Both try to manage same audio system independently, only App.tsx is active
- **Maintenance nightmare:** Changes needed in two places

#### Issue #5: Event-Based Architecture Mismatch
- **useAudio.ts Uses:** Tauri commands for background downloads
- **App.tsx Uses:** Same Tauri commands but with different wrapper logic
- **Problem:** Inconsistent error handling and retry mechanisms

---

## 4. Difference Between Bundled Audio vs Streamed Audio

### Bundled Audio (Fallback)

**wid3menu-fallback.mp3**
```
Location: /home/user/wow-is-dead-3/wid3menu-fallback.mp3
Size: 705 KB
Type: Static file served by Vite dev server / nginx
Source Code Reference: FALLBACK_AUDIO_URL = '/wid3menu-fallback.mp3'
Loading: Immediate, no download needed
Duration: ~60 seconds (preview)
Purpose: Instant user experience while main audio downloads
```

**Load Path:**
```
1. Browser requests /wid3menu-fallback.mp3
2. Vite serves from public/ directory (dev) or nginx serves (prod)
3. No authentication, no caching needed
4. Instant playback within 100-200ms
```

### Streamed Audio (Main)

**wid3menu.mp3**
```
Location: /home/user/wow-is-dead-3/wid3menu.mp3 (project root)
Size: 26 MB
Expected Endpoint: https://wowid-launcher.frostdev.io/assets/wid3menu.mp3
Status: NEVER CREATED ON SERVER
Loading: Requires download (non-blocking)
Caching: Tauri app cache directory ($XDG_CACHE_HOME/wowid3-launcher/cache/audio/)
Duration: Full-length music
Purpose: Replace fallback with better quality/longer track
```

**Attempted Load Path:**
```
1. App.tsx:205 calls cmd_download_and_cache_audio
2. Rust module (audio.rs) makes HTTP request to AUDIO_SERVER_URL
3. Response: 404 Not Found (endpoint doesn't exist)
4. Download fails after 3 retries
5. App continues with fallback indefinitely
```

### Cache Management

**Rust Implementation** (src-tauri/src/modules/audio.rs):

```rust
const AUDIO_CACHE_DIR: &str = "cache/audio";  // Relative to app cache dir

// Get cache directory
fn get_cache_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
    app_handle.path().app_cache_dir()?.join(AUDIO_CACHE_DIR)
}

// Check if cached
pub async fn get_cached_audio() -> Result<Option<String>>
    → Looks for: $APP_CACHE_DIR/cache/audio/wid3menu.mp3

// Download and cache
pub async fn download_and_cache_audio(url: String) -> Result<String>
    → Downloads to: $APP_CACHE_DIR/cache/audio/wid3menu.mp3.tmp
    → Verifies: 1MB < size < 50MB
    → Moves to: $APP_CACHE_DIR/cache/audio/wid3menu.mp3

// Clear cache
pub async fn clear_audio_cache() -> Result<()>
    → Deletes entire: $APP_CACHE_DIR/cache/audio/
```

**Cache Validation:**
- If file exists and is 1-50MB → use cached version
- If file size invalid (0, empty, corrupted) → delete and re-download
- Hash validation: None (unlike modpack files, audio isn't SHA-256 verified)

### Comparison Table

| Aspect | Bundled (Fallback) | Streamed (Main) |
|--------|------------------|-----------------|
| Size | 705 KB | 26 MB |
| Source | Project public dir | Server /assets/ |
| Load Time | Instant | 30-60 seconds |
| Caching | N/A (static) | App cache directory |
| Fallback | N/A | Bundled fallback if download fails |
| Compression | Not gzipped | Could be gzipped |
| Updates | Requires app rebuild | Server-side update |
| User Experience | Quick start, lower quality | Better quality, wait for load |

---

## 5. Audio State Management

### Current Implementation (Fragmented)

#### App.tsx State Machine (19 pieces of state)

```typescript
const [audioState, setAudioState] = useState<'loading' | 'fallback' | 'transitioning' | 'main'>('loading');
const [mainAudioReady, setMainAudioReady] = useState(false);
const fallbackRef = useRef<HTMLAudioElement>(null);
const mainRef = useRef<HTMLAudioElement>(null);
const retryIntervalRef = useRef<number | null>(null);
const retryCountRef = useRef(0);
```

**State Machine Diagram:**

```
loading
  ↓ (100ms delay)
fallback (audio playing)
  ↓ (background: loadMainAudio)
[parallel] attempting download
  ├─ 15 seconds → stuck detection
  │   ↓
  │   retry #1/3
  │   ↓
  │   [either] success → mainAudioReady = true
  │   [or] failure → retryCountRef++
  │
  └─ on success → mainAudioReady = true
     ↓
     transitioning (crossfade: 2 seconds)
     ├─ 20 volume steps over 2 seconds
     └─ Fade out fallback, fade in main
        ↓
        main (audio playing from server)
```

#### useAudioStore (Zustand)

```typescript
interface AudioState {
  isMuted: boolean;           // Master mute toggle
  wasPaused: boolean;         // Track pause before game launch
  
  setMuted: (muted: boolean) => void;
  setWasPaused: (paused: boolean) => void;
}
```

**Problems:**
- Only 2 properties (isMuted, wasPaused)
- Doesn't track loading state, errors, or current source
- App.tsx doesn't use this for audio state, only for mute flag
- LauncherHome.tsx reads `isMuted` but App.tsx manages mute independently

#### LauncherHome Audio Integration

```typescript
const { isMuted, setMuted } = useAudioStore();

// Handle mute button
onClick={() => setMuted(!isMuted)}

// Audio control
const { setMuted, setWasPaused } = useAudioStore();

// On game launch
setWasPaused(true);  // Pause audio
// ... launch game ...
// Resume? (not implemented)
```

### Issues with State Management

#### Issue #1: Fragmented State
- **App.tsx:** Complex state machine for loading/playing
- **useAudioStore:** Simple mute flags only
- **No single source of truth** for audio system state

#### Issue #2: No Error Tracking
```typescript
// No way to know why audio failed
const [audioError, setAudioError] = useState<string | null>(null);  // MISSING
```

#### Issue #3: No Download Progress
```typescript
// No feedback to user while downloading
const [downloadProgress, setDownloadProgress] = useState(0);  // MISSING
```

#### Issue #4: State Sync Issues
```typescript
// useAudioStore.isMuted is separate from actual audio element
// Mute toggle updates store, but App.tsx must also sync to audio elements
useEffect(() => {
  if (fallbackRef.current) fallbackRef.current.muted = isMuted;
  if (mainRef.current) mainRef.current.muted = isMuted;
}, [isMuted]);
// This works, but is indirect and fragile
```

#### Issue #5: Game Launch Pause Broken
```typescript
// In LauncherHome.tsx: setWasPaused(true)
// But code never resumes audio after game exits!
// The audio.rs module doesn't have resume/pause commands
```

### Recommended State Structure

```typescript
interface AudioSystemState {
  // Loading state
  isLoading: boolean;
  loadingProgress: number;  // 0-100
  currentSource: 'bundled' | 'cached' | 'streaming' | null;
  
  // Playback state
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;  // 0-1
  currentTime: number;  // Playback position
  
  // Audio transition
  audioState: 'loading' | 'fallback' | 'transitioning' | 'main';
  
  // Error handling
  error: string | null;
  retryCount: number;
  maxRetries: number;
  
  // Game integration
  wasPausedBeforeGame: boolean;
  
  // Actions
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  pauseForGame: () => void;
  resumeFromGame: () => void;
  retry: () => void;
  clearError: () => void;
}
```

---

## Summary of Issues

### Critical (Blocking)
1. **NO `/assets/` ENDPOINT** - Server never serves wid3menu.mp3
   - Location: Server router needs new route
   - Fix: Add `GET /api/assets/:filename` handler

2. **HARDCODED URL** - Launcher expects specific domain
   - Location: App.tsx:16, useAudio.ts:11
   - Issue: Won't work in development or private deployments

### Major (Degraded Experience)
3. **Unused Audio Hook** - useAudio.ts never runs
   - Location: src/hooks/useAudio.ts (orphaned)
   - Impact: Dead code, confusing for maintenance

4. **Incomplete State Management** - audioStore is minimal
   - Location: src/stores/audioStore.ts
   - Impact: Cannot track loading, errors, or sources

5. **Duplicated Logic** - useAudio.ts AND App.tsx both implement audio
   - Location: Two different files, same functionality
   - Impact: Maintenance nightmare, inconsistent behavior

### Minor (Polish)
6. **No Error UI** - Users don't know why audio failed
   - Impact: Silent failure to streaming fallback
   - User sees music but doesn't know it's low-quality preview

7. **No Download Progress** - No feedback while 26MB downloads
   - Impact: Feels like app is stuck for 30-60 seconds

8. **Game Launch Pause Broken** - Audio doesn't pause when game launches
   - Location: LauncherHome.tsx, audio.rs (missing pause command)
   - Impact: Music continues playing in background, audio bleeding

---

## Fixes Required

### 1. Add Server Audio Endpoint (CRITICAL)

**server/src/api/public.rs:**

```rust
pub async fn serve_audio_file(
    State(state): State<PublicState>,
    Path(filename): Path<String>,
) -> Result<Response, AppError> {
    // Whitelist audio files
    let allowed_files = ["wid3menu.mp3"];
    
    if !allowed_files.contains(&filename.as_str()) {
        return Err(AppError::NotFound(format!("Audio file {} not found", filename)));
    }
    
    // Get file from storage
    let audio_path = state.config.storage_path().join("assets").join(&filename);
    
    if !audio_path.exists() {
        return Err(AppError::NotFound(format!("Audio {} not configured", filename)));
    }
    
    // Stream file with proper headers
    let file = fs::File::open(&audio_path).await?;
    let stream = ReaderStream::new(file);
    
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "audio/mpeg")
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(Body::from_stream(stream))
        .unwrap())
}
```

### 2. Add Route to Router (CRITICAL)

**server/src/main.rs:**

```rust
let public_routes = Router::new()
    .route("/api/manifest/latest", get(get_latest_manifest))
    .route("/api/manifest/:version", get(get_manifest_by_version))
    .route("/api/java/:filename", get(serve_java_runtime))
    .route("/api/assets/:filename", get(serve_audio_file))  // ADD THIS
    .route("/files/:version/*path", get(serve_file))
    .with_state(public_state);
```

### 3. Remove Hardcoded URL (FOLLOW-UP)

Use environment variable instead:

```typescript
const AUDIO_SERVER_URL = import.meta.env.VITE_AUDIO_SERVER_URL 
    || 'https://wowid-launcher.frostdev.io/api/assets/wid3menu.mp3';
```

### 4. Consolidate Audio State (FOLLOW-UP)

Migrate all audio state to single Zustand store with proper structure.

### 5. Remove Duplicate Code (FOLLOW-UP)

Choose either useAudio.ts OR App.tsx approach, consolidate into single hook.

---

## File Structure Reference

### Launcher Audio Files
```
wowid3-launcher/
├── src/
│   ├── App.tsx (Active - main audio logic)
│   ├── hooks/
│   │   ├── useAudio.ts (Orphaned - not used)
│   │   ├── index.ts (exports useAudio but not used)
│   │   └── useTauriCommands.ts
│   ├── stores/
│   │   └── audioStore.ts (Minimal - only mute flag)
│   └── components/
│       └── LauncherHome.tsx (Uses audio store)
├── src-tauri/src/
│   ├── modules/
│   │   └── audio.rs (Tauri commands)
│   ├── lib.rs (Command registration)
│   └── modules/mod.rs
├── wid3menu.mp3 (26 MB, main audio)
└── wid3menu-fallback.mp3 (705 KB, preview)
```

### Server Audio Structure
```
wowid3-server/
├── server/src/
│   ├── main.rs (Router - missing /assets/ route)
│   ├── api/
│   │   ├── public.rs (Endpoint handlers - missing audio handler)
│   │   └── admin.rs
│   └── config.rs (BASE_URL configuration)
├── nginx.conf (Missing /assets/ location)
└── storage/
    ├── releases/ (Modpack files)
    ├── uploads/ (Temporary uploads)
    ├── assets/ (MISSING - where audio should be stored)
    └── drafts/
```

