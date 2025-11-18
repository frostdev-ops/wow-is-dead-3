# Audio System Issues - Quick Reference

## Current Flow (BROKEN)

```
┌─────────────────────────────────────────────────────────────────┐
│ User Opens Launcher                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ App.tsx:269 - Initialize Audio                                  │
│ • fallbackRef.current = Audio element                           │
│ • mainRef.current = Audio element                               │
│ • audioState = 'loading'                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
            ┌────────┴────────┐
            │                 │
            ▼                 ▼
  ┌──────────────────┐  ┌──────────────────────────┐
  │ Play Fallback    │  │ Download Main Audio      │
  │ (705KB)          │  │ (26MB from server)       │
  │ autoplay=true    │  │ App.tsx:205              │
  │ ✓ WORKS          │  │ invoke('cmd_download...')
  │                  │  │ ❌ FAILS - 404 not found │
  │ Duration: 60s    │  │ Endpoint missing!        │
  │ Volume: 30%      │  │ URL: /assets/wid3menu.mp3
  └──────────────────┘  └──────────────────────────┘
            │
            ├─ [Success in 3+ seconds]
            │
            ▼
  ┌──────────────────────┐
  │ 15 seconds pass      │
  │ Stuck detection:     │
  │ Retry 1/3 (fails)    │
  │ Retry 2/3 (fails)    │
  │ Retry 3/3 (fails)    │
  │ GIVE UP              │
  └──────────────────────┘
            │
            ▼
  ┌──────────────────────────────────┐
  │ audioState = 'fallback'          │
  │ mainAudioReady = false           │
  │ mainRef.src = empty              │
  │ Continue with 705KB preview      │
  │ User never gets full-quality     │
  │ music! (silent failure)          │
  └──────────────────────────────────┘
```

## The Five Critical Problems

```
┌─────────────────────────────────────────────────────────────────┐
│ PROBLEM 1: MISSING SERVER ENDPOINT (BLOCKING)                   │
├─────────────────────────────────────────────────────────────────┤
│ Launcher expects: https://wowid-launcher.frostdev.io/assets/*    │
│ Server routes:   /api/manifest/*, /api/java/*, /files/*        │
│ Missing:         /api/assets/ or /assets/                      │
│ Impact:          404 Not Found → download fails → fallback only │
│ Fix:             Add serve_audio_file() handler in public.rs    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PROBLEM 2: UNUSED HOOK (DEAD CODE)                              │
├─────────────────────────────────────────────────────────────────┤
│ File: src/hooks/useAudio.ts                                     │
│ Status: Completely orphaned                                      │
│ Uses: Tauri commands cmd_get_cached_audio, cmd_download_...     │
│ App.tsx: Never imports useAudio                                  │
│ Impact: Confusing maintenance, duplicate code                   │
│ Fix:    Delete useAudio.ts (already replaced by App.tsx logic)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PROBLEM 3: INCOMPLETE STATE MANAGEMENT                          │
├─────────────────────────────────────────────────────────────────┤
│ File: src/stores/audioStore.ts                                  │
│ Properties: isMuted, wasPaused (only 2!)                        │
│ Missing: loading state, error tracking, source type              │
│ Mismatch: App.tsx doesn't use audio state from store            │
│ Impact: Cannot display errors or loading progress               │
│ Fix:    Consolidate all audio state into one Zustand store      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PROBLEM 4: DUPLICATED LOGIC                                     │
├─────────────────────────────────────────────────────────────────┤
│ useAudio.ts:      Full audio loading logic with hooks           │
│ App.tsx:          Reimplemented same logic differently           │
│ Problem:          Two implementations, only one active           │
│ Result:           Maintenance nightmare, unclear which to fix    │
│ Fix:              Choose one approach, remove the other          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PROBLEM 5: HARDCODED DOMAIN URL                                 │
├─────────────────────────────────────────────────────────────────┤
│ App.tsx line 16:  const AUDIO_SERVER_URL = '..frostdev.io..'    │
│ Issue:            Won't work in dev or private deployments       │
│ Solution:         Use environment variable (VITE_AUDIO_URL)     │
│ Format:           import.meta.env.VITE_AUDIO_SERVER_URL         │
└─────────────────────────────────────────────────────────────────┘
```

## State Management Fragmentation

```
┌──────────────────────────────────────────────────────────────────┐
│                    CURRENT (BROKEN)                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  App.tsx (19 pieces of state)                                    │
│  ├─ [audioState]  'loading'|'fallback'|'transitioning'|'main'   │
│  ├─ [mainAudioReady] boolean                                     │
│  ├─ [fallbackRef] HTMLAudioElement                              │
│  ├─ [mainRef] HTMLAudioElement                                  │
│  ├─ [retryCountRef] number                                      │
│  └─ [retryIntervalRef] number|null                              │
│                                                                   │
│  useAudioStore (2 pieces)                   ← Ignored by App    │
│  ├─ [isMuted] boolean                      ← Only this syncs    │
│  └─ [wasPaused] boolean                    ← Never updated      │
│                                                                   │
│  LauncherHome.tsx                                                │
│  └─ Uses: setMuted() from store                                  │
│                                                                   │
│  PROBLEMS:                                                        │
│  • No error tracking (silent failures)                           │
│  • No download progress (app feels stuck)                        │
│  • No source tracking (bundled vs cached vs streaming)           │
│  • State scattered across multiple components                    │
│  • Hard to debug or extend functionality                         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  useAudioStore (Zustand - Single Source of Truth)               │
│  ├─ Loading State                                                │
│  │  ├─ isLoading: boolean                                        │
│  │  ├─ loadingProgress: 0-100                                    │
│  │  └─ audioState: 'loading'|'fallback'|'trans'|'main'          │
│  ├─ Playback State                                               │
│  │  ├─ isPlaying: boolean                                        │
│  │  ├─ isMuted: boolean                                          │
│  │  ├─ volume: 0-1                                               │
│  │  └─ currentTime: number                                       │
│  ├─ Source Tracking                                              │
│  │  └─ currentSource: 'bundled'|'cached'|'streaming'|null       │
│  ├─ Error Handling                                               │
│  │  ├─ error: string | null                                     │
│  │  ├─ retryCount: number                                        │
│  │  └─ maxRetries: number                                        │
│  ├─ Game Integration                                             │
│  │  └─ wasPausedBeforeGame: boolean                              │
│  └─ Actions                                                      │
│     ├─ toggleMute()                                              │
│     ├─ setVolume(v: number)                                      │
│     ├─ pauseForGame()                                            │
│     ├─ resumeFromGame()                                          │
│     ├─ retry()                                                   │
│     └─ clearError()                                              │
│                                                                   │
│  BENEFITS:                                                        │
│  • Single source of truth                                        │
│  • Easy to display errors to user                                │
│  • Can show download progress                                    │
│  • All components access same state                              │
│  • Clear action APIs for operations                              │
└──────────────────────────────────────────────────────────────────┘
```

## Audio Loading Flow Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│ BUNDLED (FALLBACK) - WORKING ✓                                   │
├─────────────────────────────────────────────────────────────────┤
│ File: wid3menu-fallback.mp3 (705 KB)                            │
│ Location: /wowid3-launcher/public/wid3menu-fallback.mp3         │
│ URL: /wid3menu-fallback.mp3 (relative)                          │
│ Server: Vite (dev) / Nginx static serving (prod)                │
│ Load Time: Instant (100ms)                                      │
│ Caching: Browser cache only                                     │
│ Duration: ~60 seconds preview                                   │
│ Quality: Lower (compressed preview)                             │
│ Update: Requires app rebuild                                    │
│                                                                  │
│ Status: WORKING (fallback always available)                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STREAMED (MAIN) - BROKEN ✗                                       │
├─────────────────────────────────────────────────────────────────┤
│ File: wid3menu.mp3 (26 MB)                                      │
│ Location: /wowid3-launcher/wid3menu.mp3 (project root)         │
│ Expected URL: /assets/wid3menu.mp3 or /api/assets/wid3menu.mp3  │
│ Server: AXUM endpoint (MISSING!)                                │
│ Load Time: 30-60 seconds (HTTP download + parse)                │
│ Caching: $XDG_CACHE_HOME/wowid3-launcher/cache/audio/           │
│ Duration: Full-length music                                     │
│ Quality: Better (full file)                                     │
│ Update: Server-side (no app rebuild needed)                     │
│                                                                  │
│ Status: BROKEN (404 endpoint missing)                           │
│ Fallback: Stays on bundled fallback forever                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CACHE MANAGEMENT (Tauri)                                         │
├─────────────────────────────────────────────────────────────────┤
│ Cache Path: $CACHE_HOME/wowid3-launcher/cache/audio/            │
│                                                                  │
│ Workflow:                                                        │
│ 1. Check cache: get_cached_audio()                              │
│    ✓ If exists + valid size (1-50MB) → use it                   │
│    ✗ If missing/invalid → proceed to download                   │
│                                                                  │
│ 2. Download: download_and_cache_audio(url)                      │
│    • Download to: .../cache/audio/wid3menu.mp3.tmp              │
│    • Verify size (1-50MB)                                        │
│    • Rename to: .../cache/audio/wid3menu.mp3                    │
│    • Retry 3x on failure                                        │
│                                                                  │
│ 3. Read for playback: read_cached_audio_bytes()                 │
│    • Convert to Uint8Array                                      │
│    • Create Blob URL via URL.createObjectURL()                  │
│    • Load into <audio> element                                  │
│                                                                  │
│ 4. Clear cache: clear_audio_cache()                             │
│    • Deletes entire: .../cache/audio/                           │
│    • Used for testing or when corrupted                         │
│                                                                  │
│ Validation:                                                      │
│ • No SHA-256 verification (unlike modpack files)                │
│ • Only size-based validation (1-50MB)                           │
│ • No expiration/staleness check                                 │
└─────────────────────────────────────────────────────────────────┘
```

## What Needs to Be Fixed

### Tier 1: CRITICAL (Blocking Feature)
- [ ] Create `/api/assets/` endpoint on server (serve_audio_file)
- [ ] Add route to server router (main.rs)
- [ ] Create `storage/assets/` directory on server
- [ ] Place wid3menu.mp3 in storage/assets/
- [ ] Update nginx.conf to proxy `/api/assets/`

### Tier 2: MAJOR (Code Cleanup)
- [ ] Delete src/hooks/useAudio.ts (orphaned code)
- [ ] Consolidate audio state to useAudioStore
- [ ] Remove hardcoded URLs (use env variables)
- [ ] Remove duplicate logic

### Tier 3: POLISH (UX Improvements)
- [ ] Add error display to UI
- [ ] Show download progress while loading
- [ ] Implement audio pause/resume for game launch
- [ ] Add hash validation for cached audio

## File Changes Required

```
wowid3-server/
├── server/src/
│   ├── api/public.rs          [ADD serve_audio_file() function]
│   └── main.rs                [ADD /api/assets/:filename route]
├── storage/assets/            [CREATE directory]
│   └── wid3menu.mp3           [PLACE audio file here]
└── nginx.conf                 [ADD /api/assets/ location]

wowid3-launcher/
├── src/
│   ├── App.tsx                [REMOVE hardcoded URL]
│   ├── hooks/useAudio.ts      [DELETE file - orphaned]
│   ├── hooks/index.ts         [REMOVE useAudio export]
│   └── stores/audioStore.ts   [EXPAND with full state]
├── .env.example               [ADD VITE_AUDIO_SERVER_URL]
└── vite.config.ts             [ADD env vars]
```

## Testing Checklist

After fixes:

```
[ ] Server endpoint returns 200 OK for /api/assets/wid3menu.mp3
[ ] Audio file downloads successfully (monitor network tab)
[ ] Downloaded file cached in $XDG_CACHE_HOME/wowid3-launcher/cache/audio/
[ ] Fallback plays immediately (within 100ms)
[ ] Main audio loads within 60 seconds (on good connection)
[ ] Crossfade transition smooth (2 second fade)
[ ] Main audio loops correctly
[ ] Mute button works for both fallback and main
[ ] Audio stops when game launches (if implemented)
[ ] Cache persists between app restarts
[ ] Clear cache button works correctly
[ ] Error messages display on network failure
[ ] Retry mechanism works (simulate network timeout)
```

