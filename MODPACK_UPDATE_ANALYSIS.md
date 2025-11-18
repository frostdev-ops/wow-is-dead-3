# Complete Modpack Update Flow Analysis - WOWID3 Launcher

## Overview
The modpack update system is a sophisticated differential update mechanism that:
- Detects updates via manifest hash comparison
- Downloads only changed files (delta updates)
- Verifies integrity via SHA-256 checksums
- Supports full verification and repair operations
- Handles failures with exponential backoff retries
- Provides real-time progress tracking

---

## 1. UPDATE DETECTION FLOW

### A. Manifest Hash Versioning System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UPDATE DETECTION CYCLE                               │
└─────────────────────────────────────────────────────────────────────────────┘

1. INITIALIZATION (On App Mount)
   ├── Get installed version from .wowid3-version file
   │   └── Contains semantic version: "1.0.0"
   │
   └── Initial poll for updates (immediate + every 5 minutes)

2. MANIFEST FETCH
   useModpack.ts (lines 43-45):
   ├── Call: checkForUpdates(manifestUrl)
   │   └── useTauriCommands.ts (line 61):
   │       └── invoke 'cmd_check_updates' with manifestUrl
   │           └── lib.rs (line 462-466):
   │               └── check_for_updates()
   │                   └── updater.rs (lines 47-84):
   │                       ├── Create HTTP client with 10s timeout
   │                       ├── GET request to manifest server
   │                       ├── Parse JSON response
   │                       └── Return Manifest struct

   Manifest Structure:
   {
     "version": "1.2.0",                    // Semantic version
     "minecraft_version": "1.20.1",
     "fabric_loader": "0.15.0",
     "changelog": "Update changelog",
     "files": [
       {
         "path": "mods/mod1.jar",
         "url": "https://...",
         "sha256": "abc123...",             // SHA-256 of each file
         "size": 5242880
       }
     ]
   }

3. DUAL VERSION CHECK (useModpack.ts lines 48-69)
   
   Check #1: VERSION STRING COMPARISON
   ├── if (manifest.version !== installedVersion)
   │   ├── versionChanged = true
   │   └── setUpdateAvailable(true)
   │
   Check #2: MANIFEST HASH COMPARISON (if version same)
   ├── Calculate manifest hash from current manifest
   │   └── calculate_manifest_hash() (updater.rs lines 87-101)
   │       ├── Hash version string
   │       └── Hash all file SHA-256s in order
   │           └── Result: "7f9e3c..." (SHA-256 of manifest contents)
   │
   ├── Load stored manifest hash from .wowid3-manifest-hash
   │   └── get_stored_manifest_hash() (updater.rs lines 104-115)
   │       └── Read .wowid3-manifest-hash file
   │
   └── if (stored != current)
       ├── manifestHasChanged = true
       └── setUpdateAvailable(true)

   Result:
   ├── NEW VERSION → Update Available
   │   (e.g., 1.0.0 → 1.2.0)
   ├── FILES CHANGED (same version) → Update Available
   │   (e.g., 1.0.0 with modified mods → Update Available)
   └── NO CHANGES → No Update
       (same version & same manifest hash)
```

### B. Key Files for Update Detection

- **updater.rs (lines 87-101)**: `calculate_manifest_hash()`
  - Combines version + all file hashes
  - Deterministic SHA-256 hash
  - ANY file change → Different hash

- **updater.rs (lines 127-132)**: `has_manifest_changed()`
  - Compares current hash vs stored hash
  - Allows updates without version bump

- **.wowid3-manifest-hash**: Persistent hash storage
  - Stores last-seen manifest hash
  - Updated after successful install/repair

- **.wowid3-version**: Version tracking
  - Stores installed modpack version
  - Simple string (semantic version)

---

## 2. FILE CHANGE DETECTION (DELTA UPDATES)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETERMINING FILES TO DOWNLOAD                            │
└─────────────────────────────────────────────────────────────────────────────┘

Flow: install_modpack() → get_files_to_download()
      (updater.rs lines 448-550)

1. DELTA COMPARISON LOOP (updater.rs lines 406-440)
   
   for each file in manifest.files:
   {
     file_path = game_dir / file.path
     
     DECISION TREE:
     
     ├─ File doesn't exist?
     │  └─ DOWNLOAD IT
     │     └─ Log: "[Delta] Missing: mods/mod1.jar"
     │
     └─ File exists?
        │
        └─ Verify checksum
           ├─ verify_file_checksum() (updater.rs lines 135-149)
           │  ├─ Read entire file into memory
           │  ├─ Calculate SHA-256 hash
           │  ├─ Compare with manifest SHA-256
           │  │
           │  └─ RESULT: Match? Corrupted? Error?
           │
           ├─ Checksum MATCHES?
           │  └─ SKIP IT (already have correct version)
           │     └─ No log output
           │
           ├─ Checksum MISMATCHES?
           │  └─ DOWNLOAD IT (file changed or corrupted)
           │     └─ Log: "[Delta] Checksum mismatch: mods/mod1.jar"
           │
           └─ Error verifying (permission/I/O)?
              └─ DOWNLOAD IT (to be safe)
                 └─ Log: "[Delta] Error verifying mods/mod1.jar..."
   }

2. RESULT VECTORS
   
   files_to_download[] contains only:
   ├─ Missing files (don't exist locally)
   ├─ Modified files (SHA-256 mismatch)
   └─ Inaccessible files (I/O errors)

   SKIPPED files:
   └─ Already exist with correct SHA-256

3. EXAMPLE SCENARIO
   
   Manifest (new):
   ├─ mod1.jar (sha: ABC123)
   ├─ mod2.jar (sha: DEF456)
   └─ mod3.jar (sha: GHI789)
   
   Local files (before update):
   ├─ mod1.jar (sha: ABC123) ✓ matches → SKIP
   ├─ mod2.jar (sha: XXXYYYY) ✗ mismatch → DOWNLOAD
   └─ mod3.jar (missing) → DOWNLOAD
   
   Download queue:
   ├─ mod2.jar (re-download due to corruption/change)
   └─ mod3.jar (new mod added)
   
   Efficiency:
   ├─ No hash verification overhead
   ├─ Only 2 files downloaded instead of 3
   └─ If modpack is 2GB with 1 changed file, download ~300MB instead of 2GB
```

---

## 3. PARALLEL DOWNLOAD ORCHESTRATION

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              DOWNLOAD MANAGER: CONCURRENT ORCHESTRATION                     │
└─────────────────────────────────────────────────────────────────────────────┘

Flow: install_modpack() (lib.rs 476-494)

1. PRE-DOWNLOAD CHECKS
   
   ├─ Check disk space
   │  └─ check_disk_space() (updater.rs lines 326-403)
   │     ├─ Get file system mount point
   │     ├─ Calculate total bytes to download
   │     ├─ Add 10% safety buffer
   │     └─ ABORT if insufficient space
   │
   ├─ Calculate optimal concurrency
   │  └─ calculate_optimal_concurrency() (download_manager.rs lines 281-292)
   │     ├─ 1-2 cores → 15 concurrent downloads
   │     ├─ 3-4 cores → 25 concurrent downloads
   │     ├─ 5-8 cores → 35 concurrent downloads
   │     └─ 9+ cores → 50 concurrent downloads
   │
   └─ Create DownloadManager
      └─ download_manager.rs (lines 57-71)
         ├─ HTTP client with connection pooling
         ├─ Semaphore for concurrency control
         └─ Max retries: 3 attempts per file

2. TASK QUEUE CREATION
   
   for each file in files_to_download:
   {
     Create DownloadTask:
     {
       url: "https://server/mods/mod1.jar",
       dest: "/game/mods/mod1.jar",
       expected_hash: HashType::Sha256("abc123..."),
       priority: DownloadPriority::Low,  // Modpack files
       size: 5242880
     }
   }
   
   Tasks are sorted by priority:
   ├─ High (3) → Libraries
   ├─ Medium (2) → Assets
   └─ Low (1) → Modpack files

3. PARALLEL DOWNLOAD EXECUTION
   
   DownloadManager.download_files() (download_manager.rs lines 194-224)
   
   ┌─ Concurrent Queue Management ──────────────────────────┐
   │                                                         │
   │  Tasks:      [mod1, mod2, mod3, mod4, mod5, ...]      │
   │                                                         │
   │  Stream:     [Buffer up to 1000 tasks]                │
   │                                                         │
   │  Semaphore:  [Limit to N concurrent (15-50)]          │
   │              [Based on CPU cores]                      │
   │                                                         │
   │  ├─ Permit 1 → Download mod1 (streaming)              │
   │  ├─ Permit 2 → Download mod2 (streaming)              │
   │  ├─ Permit N → Download modN (streaming)              │
   │  │                                                     │
   │  ├─ mod1 completes → Free permit 1                    │
   │  │ → Pick next task from queue                        │
   │  │                                                     │
   │  └─ Repeat until all complete or error                │
   │                                                         │
   └─────────────────────────────────────────────────────────┘

4. SINGLE FILE DOWNLOAD (with retry)
   
   download_file_with_retry() loop (download_manager.rs lines 86-122)
   
   Attempt 1:
   └─ download_attempt()
      ├─ Create parent directories
      ├─ GET request with streaming
      ├─ Stream chunks to disk
      │  ├─ Update SHA-256 hash for each chunk
      │  ├─ Write to file
      │  ├─ Send progress event
      │  └─ Continue until EOF
      ├─ Verify final SHA-256 hash
      └─ SUCCESS or FAIL
   
   If FAIL and attempts < max_retries (3):
   ├─ Wait exponential backoff: 2^attempt seconds
   │  ├─ Attempt 1 fail → Wait 2s
   │  ├─ Attempt 2 fail → Wait 4s
   │  └─ Attempt 3 fail → Wait 8s
   └─ Retry with same task
   
   If all attempts fail:
   └─ Return error → Abort entire download

5. REAL-TIME PROGRESS TRACKING
   
   Progress Channel (Tokio MPSC):
   ├─ Each download task sends updates
   │  └─ DownloadProgress {
   │      url: "...",
   │      bytes_downloaded: 1048576,
   │      total_bytes: 5242880,
   │      completed: false
   │    }
   │
   ├─ Progress aggregator task collects
   │  └─ Accumulates bytes across all tasks
   │
   ├─ Progress callback fires
   │  └─ callback(current_file, total_files, filename, 
   │             bytes_done, total_bytes)
   │
   └─ Emits to React
      └─ app.emit("download-progress", DownloadProgressEvent)
         ├─ current: 5 (file 5 of 10)
         ├─ total: 10
         ├─ filename: "mods/mod5.jar"
         ├─ current_bytes: 524288000
         └─ total_bytes: 2097152000

6. POST-DOWNLOAD CLEANUP
   
   ├─ cleanup_extra_mods() (updater.rs lines 269-323)
   │  ├─ Scan mods/ directory
   │  ├─ Compare each .jar with manifest
   │  └─ DELETE any mods NOT in manifest
   │     └─ Ensures clean state
   │
   ├─ update_version_file() (updater.rs lines 259-265)
   │  └─ Write "1.2.0" to .wowid3-version
   │
   └─ save_manifest_hash() (updater.rs lines 118-124)
      └─ Write manifest hash to .wowid3-manifest-hash
         └─ Enables delta detection next update
```

---

## 4. VERIFY & REPAIR SYSTEM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│         VERIFY & REPAIR: DEEP INTEGRITY CHECK & AUTO-REPAIR                 │
└─────────────────────────────────────────────────────────────────────────────┘

Triggered by: User clicks "Verify & Repair" button
             (useModpack.ts lines 143-179)

Flow: verifyAndRepairModpack() (updater.rs lines 554-658)

1. VERIFICATION PHASE
   
   ├─ Fetch latest manifest from server
   │  └─ Same as update detection
   │
   ├─ Scan all files
   │  └─ get_files_to_download(manifest, game_dir)
   │     (REUSES delta detection logic)
   │     
   │     For each file in manifest:
   │     ├─ Check existence
   │     ├─ Verify SHA-256 checksum
   │     └─ Collect corrupted/missing
   │
   └─ files_to_repair = all files needing re-download

2. REPAIR DECISION
   
   if files_to_repair.is_empty():
   ├─ All files OK
   ├─ Log: "[Repair] ✓ All files verified - no corruption detected"
   └─ Return success
   
   else:
   ├─ Found corrupted/missing files
   ├─ Log: "[Repair] Found X corrupted/missing files to repair"
   └─ Proceed to repair phase

3. REPAIR PHASE
   
   ├─ Check disk space for repair
   │  └─ calculate_total_size(files_to_repair)
   │
   ├─ Create download queue
   │  └─ Same as install, but only corrupted files
   │
   ├─ Parallel download
   │  └─ DownloadManager downloads repairs
   │
   └─ Update manifest hash
      └─ save_manifest_hash()
         └─ Prevents re-detection of same corruption

4. DIFFERENCES FROM NORMAL UPDATE
   
   Normal Install:
   ├─ Downloads missing/changed files
   ├─ Skips correct files
   └─ Uses file existence + hash
   
   Verify & Repair:
   ├─ Scans ALL files even if version matches
   ├─ Detects corruption in unchanged version
   ├─ Same delta detection, but forced scan
   └─ Useful for:
       ├─ Disk corruption
       ├─ Partial downloads (crashed)
       ├─ Network disconnections
       └─ Game crashes due to mod issues

5. EXAMPLE CORRUPTION SCENARIO
   
   Initial state:
   ├─ Installed version: 1.0.0
   ├─ Manifest hash saved: 7f9e3c...
   ├─ All files present and correct
   
   Corruption event:
   ├─ mod2.jar corrupted (disk error)
   └─ Version still shows 1.0.0
   
   Update poll:
   ├─ Fetches manifest (same 1.0.0)
   ├─ Calculates hash (still 7f9e3c...)
   ├─ Compares to stored (also 7f9e3c...)
   └─ NO UPDATE DETECTED (manifest hash matches)
   
   User runs Verify & Repair:
   ├─ Checks manifest again
   ├─ Scans mod2.jar
   ├─ SHA-256 mismatch detected
   ├─ Downloads mod2.jar
   └─ Corruption fixed
```

---

## 5. ERROR HANDLING & RETRY LOGIC

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              ERROR HANDLING & EXPONENTIAL BACKOFF RETRIES                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. MANIFEST FETCH ERRORS
   
   check_for_updates() (updater.rs lines 47-84)
   
   Network Error:
   ├─ Timeout (10 seconds)
   ├─ Connection refused
   ├─ DNS resolution failure
   └─ → Return error (no retry, single attempt)
      └─ Error bubbles to React
      └─ User sees: "Check your network connection"
   
   HTTP Errors:
   ├─ 404 Not Found
   ├─ 500 Server Error
   └─ → Return error with status code
      └─ useModpack catches (line 71)
      └─ console.error with context
   
   JSON Parse Error:
   ├─ Manifest is not valid JSON
   └─ → Return "Invalid JSON" error
      └─ User gets clear error message

2. FILE DOWNLOAD RETRIES
   
   DownloadManager.download_file() (download_manager.rs lines 76-123)
   
   Retry Loop:
   │
   ├─ Attempt 1:
   │  └─ download_attempt()
   │     ├─ HTTP GET request
   │     ├─ Stream to disk
   │     └─ Verify hash
   │
   ├─ Attempt fails (attempt < max_retries = 3)
   │  │
   │  ├─ Calculate backoff: 2^attempt seconds
   │  │  ├─ Attempt 1 fail → backoff = 2^1 = 2 seconds
   │  │  ├─ Attempt 2 fail → backoff = 2^2 = 4 seconds
   │  │  └─ Attempt 3 fail → backoff = 2^3 = 8 seconds
   │  │
   │  ├─ Log warning: "Download failed (attempt 1/4): ..."
   │  ├─ Sleep(backoff)
   │  └─ Loop back to attempt 2
   │
   ├─ All attempts exhausted
   │  └─ Return error: "Failed to download FILE after 3 attempts"
   │
   └─ Single success
      └─ Send completion event
      └─ Continue to next file

3. HASH VERIFICATION ERRORS
   
   verify_hash() (download_manager.rs lines 235-252)
   
   After download completes:
   ├─ Compare actual hash vs expected
   ├─ Case-insensitive comparison (lowercase both)
   │
   ├─ Match:
   │  └─ File is good, move on
   │
   └─ Mismatch:
      ├─ File corrupted during download
      ├─ Error: "Hash mismatch for FILE: expected X got Y"
      └─ Triggers retry (goes back to Attempt loop)

4. DISK SPACE ERRORS
   
   check_disk_space() (updater.rs lines 326-403)
   
   ├─ Calculate required space (total_size + 10% buffer)
   ├─ Get available space from filesystem
   │
   ├─ Sufficient space:
   │  └─ Continue
   │
   └─ Insufficient space:
      ├─ Error: "Insufficient disk space: X MB available, Y MB required"
      └─ Abort entire operation
         └─ User must free space and retry

5. CONCURRENT DOWNLOAD AGGREGATION
   
   download_files() (download_manager.rs lines 194-224)
   
   ├─ Spawn all download tasks
   ├─ Each task returns Result<(), Error>
   ├─ Collect all results
   │
   ├─ If any task fails:
   │  ├─ Collect all errors
   │  └─ Return: "Download failures: N files failed"
   │     └─ This terminates entire operation
   │
   └─ All succeed:
      └─ Continue to cleanup

6. GRACEFUL ERROR PROPAGATION
   
   useModpack.ts install() (lines 102-141)
   
   try {
     await installModpack(manifest, gameDirectory)
     → SUCCESS
   } catch (err) {
     setError(err.message)
     throw err
     → React component handles error
   } finally {
     setDownloading(false)
     → UI unlocks regardless
   }
```

---

## 6. COMPLETE FLOW DIAGRAM: FROM DETECTION TO COMPLETION

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    END-TO-END UPDATE FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

USER LAUNCHES APP
│
├─► useModpack() Hook Init
│   ├─ On mount: Get installed version
│   └─ Start 5-minute polling interval
│
└─► Polling Loop (every 5 minutes)
    │
    ├─ Step 1: FETCH MANIFEST
    │  └─ checkForUpdates(manifestUrl)
    │     └─ HTTP GET manifest.json
    │        ├─ SUCCESS: Parse JSON → Manifest
    │        └─ FAIL: Error to console, retry in 5 min
    │
    ├─ Step 2: DETECT UPDATE
    │  ├─ Compare versions
    │  │  └─ manifest.version != installedVersion
    │  │     └─ YES → updateAvailable = true
    │  │
    │  └─ Compare manifest hashes (if same version)
    │     └─ current_hash != stored_hash
    │        └─ YES → updateAvailable = true
    │
    ├─ Update UI
    │  └─ Set updateAvailable flag
    │     └─ Shows "Update Available" button
    │
    └─ Sleep 5 minutes
       └─ Loop back


USER CLICKS "UPDATE" BUTTON
│
├─ Step 3: CHECK FILES TO DOWNLOAD
│  │
│  └─ install() function triggered
│     └─ installModpack(manifest, gameDirectory)
│        │
│        ├─ For each file in manifest:
│        │  │
│        │  ├─ File exists locally?
│        │  │  ├─ NO → Add to download queue
│        │  │  │
│        │  │  └─ YES:
│        │  │     ├─ Calculate SHA-256 of local file
│        │  │     ├─ Compare with manifest SHA-256
│        │  │     ├─ Match → Skip file
│        │  │     └─ Mismatch → Add to download queue
│        │  │
│        │  └─ files_to_download[] collected
│        │
│        └─ Return list of files needing download
│
├─ Step 4: PRE-DOWNLOAD VALIDATION
│  │
│  ├─ Empty list?
│  │  └─ All files up to date
│  │     ├─ Update version file
│  │     └─ Return success
│  │
│  ├─ Check disk space
│  │  ├─ Insufficient?
│  │  │  └─ ERROR: Abort, user frees space
│  │  │
│  │  └─ Sufficient
│  │     ├─ Calculate optimal concurrency
│  │     └─ Create DownloadManager
│  │
│  └─ setDownloading(true)
│     └─ UI shows progress spinner
│
├─ Step 5: START PARALLEL DOWNLOADS
│  │
│  ├─ Create download tasks (one per file)
│  │
│  ├─ Sort by priority
│  │
│  ├─ Queue tasks to DownloadManager
│  │
│  ├─ Spawn progress aggregator task
│  │
│  └─ Start N concurrent downloads (semaphore controlled)
│     │
│     └─ For each download:
│        ├─ Acquire semaphore permit
│        ├─ HTTP GET with streaming
│        ├─ Stream chunks to disk
│        │  ├─ Calculate SHA-256 hash incrementally
│        │  ├─ Write chunk to file
│        │  └─ Send progress event
│        ├─ Verify final hash
│        │  ├─ Match → success event
│        │  └─ Mismatch → retry (backoff 2^attempt)
│        │     ├─ Attempt 2: wait 2s, retry
│        │     ├─ Attempt 3: wait 4s, retry
│        │     └─ Attempt 4: wait 8s, final attempt
│        │        └─ Fail: error propagates
│        └─ Release semaphore permit
│
├─ Step 6: REAL-TIME PROGRESS UPDATES
│  │
│  └─ Progress channel sends updates
│     ├─ Progress aggregator accumulates bytes
│     ├─ Callback fires: callback(current_file, total, name, bytes, total)
│     ├─ Emits to React: 'download-progress' event
│     └─ useModpack listen handler updates UI
│        ├─ Download progress: "X of Y files, Z.Z MB"
│        ├─ Speed: calculated from bytes/time
│        └─ ETA: estimated time remaining
│
├─ Step 7: DOWNLOAD COMPLETION (or failure)
│  │
│  ├─ All files complete:
│  │  │
│  │  ├─ cleanup_extra_mods()
│  │  │  ├─ Scan mods/ directory
│  │  │  ├─ Delete any JAR not in manifest
│  │  │  └─ Log removed count
│  │  │
│  │  ├─ update_version_file()
│  │  │  └─ Write new version to .wowid3-version
│  │  │
│  │  ├─ save_manifest_hash()
│  │  │  └─ Write manifest hash to .wowid3-manifest-hash
│  │  │
│  │  ├─ setInstalledVersion(manifest.version)
│  │  │
│  │  ├─ setUpdateAvailable(false)
│  │  │
│  │  └─ reset() → Clear downloading state
│  │
│  └─ Any file fails (after retries):
│     ├─ Collect all errors
│     ├─ Return: "Download failures: N files failed"
│     ├─ setError(error message)
│     └─ UI shows error, user can retry


USER CLICKS "VERIFY & REPAIR" BUTTON
│
├─ Step 8: VERIFICATION PHASE
│  │
│  ├─ Fetch latest manifest (same as update detection)
│  │
│  ├─ For each file in manifest:
│  │  ├─ Check if exists
│  │  └─ Verify SHA-256 checksum
│  │
│  └─ Collect corrupted/missing files
│
├─ Step 9: REPAIR DECISION
│  │
│  ├─ No corrupted files?
│  │  └─ "[Repair] ✓ All files verified - no corruption detected"
│  │
│  └─ Found corrupted files?
│     └─ Proceed to repair
│
├─ Step 10: REPAIR EXECUTION
│  │
│  ├─ Download only corrupted files (same as update)
│  │
│  ├─ Verify hashes on download
│  │
│  └─ Update manifest hash
│
└─ COMPLETE
   ├─ Modpack is now fully repaired
   └─ All files match manifest


SYSTEM STATE TRACKING
│
├─ useModpackStore (modpackStore.ts):
│  ├─ installedVersion: null → "1.0.0" → "1.2.0"
│  ├─ latestManifest: null → Manifest
│  ├─ updateAvailable: false → true → false
│  ├─ isDownloading: false → true → false
│  ├─ downloadProgress: null → {current: 5, total: 100} → null
│  └─ error: null → "error msg" → null
│
└─ File System State:
   ├─ .wowid3-version: "1.0.0" → "1.2.0"
   └─ .wowid3-manifest-hash: "old_hash" → "new_hash"
```

---

## 7. KEY ARCHITECTURAL INSIGHTS

### A. Why Delta Updates Work

1. **SHA-256 Uniqueness**
   - Every file has unique SHA-256 in manifest
   - Any file corruption changes hash
   - Enables reliable change detection

2. **Manifest Hash Enables Version-Less Updates**
   - Can update files without version bump
   - Server changes mods, same version
   - Launch detects "manifest changed", downloads update
   - Users get latest even without version change

3. **Three-Level Redundancy**
   - File-level SHA-256 (per-file verification)
   - Manifest hash (detect any file changes)
   - Version string (semantic versioning)
   - Users get updates even if only mods change

### B. Concurrency Control

```
CPU Cores       Concurrent Downloads    Rationale
─────────────────────────────────────────────────────
1-2             15                      Conservative
3-4             25                      Balanced
5-8             35                      Aggressive
9+              50                      Maximum

Download Manager:
├─ Semaphore: limits actual concurrent network operations
├─ Stream buffer: up to 1000 tasks queued
├─ Per-host connection pooling: efficient reuse
└─ Connection timeout: 30s
    Request timeout: 300s (5 minutes per file)
```

### C. Retry Strategy

```
File Download Failure Flow:

Attempt 1 (t=0s)
├─ FAIL → backoff = 2^1 = 2 seconds
│
Attempt 2 (t=2s)
├─ FAIL → backoff = 2^2 = 4 seconds
│
Attempt 3 (t=6s)
├─ FAIL → backoff = 2^3 = 8 seconds
│
Attempt 4 (t=14s)
├─ FAIL → Total elapsed ~14+ seconds
│
FINAL RESULT: Error (max 3 retries exhausted)

Total wait time before failure: 2 + 4 + 8 = 14 seconds
Exponential backoff prevents network thrashing
```

### D. Progress Granularity

```
Two Progress Levels:

1. Per-File (download_manager.rs):
   └─ DownloadProgress {
      bytes_downloaded: 1048576,    (per-file)
      total_bytes: 5242880,          (per-file)
      completed: false               (partial progress)
    }

2. Aggregated (updater.rs):
   └─ Progress callback:
      ├─ current: 5                  (5 files done)
      ├─ total: 100                  (100 total files)
      ├─ filename: "mods/mod5.jar"   (current file)
      ├─ current_bytes: 524288000    (total bytes so far)
      └─ total_bytes: 2097152000     (total bytes needed)

React receives aggregated progress via Tauri events
```

---

## 8. ERROR SCENARIOS & RECOVERY

### Scenario 1: Network Interruption During Download

```
Timeline:
├─ t=0s: Download starts, 10 files queued
├─ t=5s: Downloaded 30% of first 5 files
├─ t=6s: Network dies (internet disconnected)
│
├─ Active downloads detect connection loss
│  └─ All return error (connection reset)
│
├─ Retry logic engages
│  ├─ Wait 2 seconds
│  ├─ Attempt 2: Network still down
│  ├─ Wait 4 seconds
│  ├─ Attempt 3: Network still down
│  ├─ Wait 8 seconds
│  ├─ Attempt 4: Network still down
│
├─ t=14s: All failed downloads exhausted retries
├─ Error: "Download failures: 5 files failed"
│
└─ Recovery:
   ├─ setDownloading(false)
   ├─ setError("Network connection lost")
   ├─ UI shows error dialog
   └─ User clicks retry when network back
      └─ Start fresh (delta detection resumes)
```

### Scenario 2: Corrupted File (Mid-Download)

```
Timeline:
├─ mod2.jar downloading
├─ 80% complete, chunks streaming
├─ Chunk received corrupted (network glitch)
├─ Data written to disk
├─ File download completes
│
├─ Hash verification:
│  ├─ Calculate actual hash
│  └─ Compare with expected
│      └─ MISMATCH → Error
│
├─ Retry logic:
│  ├─ Attempt 2: Fresh download, correct hash
│  └─ File is good
│
└─ Download continues (other files proceed in parallel)
```

### Scenario 3: Disk Full During Download

```
Timeline:
├─ First 5 files downloaded successfully
├─ Writing 6th file
├─ Disk full error (device full)
│
├─ Error in download_attempt:
│  └─ "Failed to write chunk" (I/O error)
│
├─ Retry logic engages
│  ├─ Attempt 2: Still disk full
│  ├─ Attempt 3: Still disk full
│  └─ Attempt 4: Still disk full → Fail
│
├─ Aggregate error:
│  └─ "Download failures: 1 file failed"
│
└─ Recovery:
   ├─ Error: "No space left on device"
   ├─ User must free disk space
   └─ Retry operation
      └─ check_disk_space() passes this time
```

### Scenario 4: Manifest Changed Between Detection & Download

```
Timeline:
├─ User polls for updates (t=0s)
├─ Manifest 1.2.0 with 50 files
├─ Downloads 5 files successfully
│
├─ Server updates manifest (t=30s) (example: bug fix)
├─ Manifest now 1.2.1 with 52 files (2 new mods)
│
├─ User's download still in progress
├─ Download based on old manifest (1.2.0)
│
└─ Recovery:
   ├─ After download completes
   ├─ Next poll (in 5 minutes) will detect 1.2.1
   ├─ Will download 2 new files
   └─ Eventually consistent
```

---

## 9. PERFORMANCE CHARACTERISTICS

### Bandwidth Utilization

```
Scenario A: Full Install (first time)
├─ Modpack: 2GB (100 files)
├─ Download: ALL 100 files
├─ Concurrency: 25 parallel (4-core CPU)
├─ Bandwidth: ~100 Mbps
├─ Time: ~160 seconds (2.67 minutes)

Scenario B: Single Mod Updated
├─ Modpack: 2GB (100 files)
├─ Previous version: 100 files, 2GB total
├─ Delta: 1 file changed (30 MB new version)
├─ Download: 1 file only
├─ Bandwidth: ~100 Mbps
├─ Time: ~2.4 seconds
├─ Savings: ~157.6 seconds (99% faster)

Scenario C: Multiple Mods Updated
├─ Modpack: 2GB (100 files)
├─ Delta: 5 files changed (150 MB total)
├─ Download: 5 files only
├─ Concurrency: 5 parallel downloads
├─ Bandwidth: ~100 Mbps
├─ Time: ~12 seconds
├─ Savings: ~148 seconds (92% faster)
```

### Memory Usage

```
Download Manager:
├─ DownloadManager struct: ~1 KB
├─ HTTP client: ~5 KB
├─ Semaphore: minimal
├─ Per-active-download:
│  ├─ Streamed chunks: 64 KB buffer (not full file)
│  ├─ SHA-256 hasher: ~109 bytes
│  └─ Total: ~64 KB per active download
│
├─ Example (25 concurrent):
│  ├─ Base: ~10 KB
│  ├─ Active downloads: 25 × 64 KB = 1.6 MB
│  └─ Total: ~1.7 MB (streaming, not loading all)

✓ Memory efficient (streaming, not loading entire files)
✓ Multiple large files donwloadable simultaneously
```

---

## 10. SUMMARY TABLE

| Component | File | Function | Purpose |
|-----------|------|----------|---------|
| **Update Detection** | updater.rs | `check_for_updates()` | Fetch manifest from server |
| | updater.rs | `calculate_manifest_hash()` | Generate hash from manifest |
| | updater.rs | `has_manifest_changed()` | Compare current vs stored |
| **Delta Calculation** | updater.rs | `get_files_to_download()` | List files needing update |
| | updater.rs | `verify_file_checksum()` | Check local file hash |
| **Download Mgmt** | download_manager.rs | `DownloadManager::new()` | Create manager |
| | download_manager.rs | `download_files()` | Parallel download coordinator |
| | download_manager.rs | `download_attempt()` | Stream single file |
| **Progress** | updater.rs | progress_callback | Report progress to React |
| | lib.rs | `DownloadProgressEvent` | Event structure |
| **Verify/Repair** | updater.rs | `verify_and_repair_modpack()` | Check & fix corruption |
| **State Mgmt** | modpackStore.ts | `useModpackStore` | Zustand store (React) |
| | useModpack.ts | `useModpack()` | Hook (React) |

---

## END OF ANALYSIS
