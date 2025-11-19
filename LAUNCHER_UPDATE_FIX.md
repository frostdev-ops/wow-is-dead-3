# Launcher Update Issue - IMPORTANT

## Problem
The launcher update modal appears repeatedly after updating because the downloaded executable has the same version as the old one.

## Root Cause
The version number is embedded in the executable at build time from `tauri.conf.json`. If you:
1. Build launcher with version `0.1.0`
2. Upload it as version `1.01` to the server
3. Launcher downloads and replaces itself

The new executable **still has version `0.1.0`** internally, so it will detect `1.01` > `0.1.0` and show the update modal again infinitely.

## Correct Workflow

### Step 1: Update Version in Source
```bash
cd wowid3-launcher
```

Edit `src-tauri/tauri.conf.json`:
```json
{
  "version": "1.0.1",  // <-- Change this BEFORE building
  ...
}
```

Also update `package.json` if desired:
```json
{
  "version": "1.0.1",  // <-- Keep in sync
  ...
}
```

### Step 2: Build New Version
```bash
npm run tauri build -- --target x86_64-pc-windows-msvc
```

### Step 3: Upload to Server
- Go to Admin Panel → Launcher
- Upload the newly built `WOWID3Launcher.exe`
- **Version**: `1.0.1` (must match tauri.conf.json)
- Changelog: "Your changes here"
- Click "Release Update"

### Step 4: Test
- Old launcher (v0.1.0) will see update to v1.0.1
- Downloads and installs
- New launcher restarts with v1.0.1
- No more update prompt (versions match)

## Version Number Format

The server manifest shows `1.01` but this should be formatted as `1.0.1` for proper semantic versioning:
- ✅ Correct: `1.0.1`, `1.1.0`, `2.0.0`
- ❌ Incorrect: `1.01`, `1.1`, `2` (will work but not standard)

## Current State

Based on the screenshot:
- Launcher binary version: `0.1.0` (from tauri.conf.json)
- Server version: `1.01`
- Result: Update detected ✓, but new binary also has `0.1.0` → infinite loop

## Fix

**Option A - Recommended**: 
1. Update `tauri.conf.json` to version `1.0.1`
2. Rebuild the launcher
3. Re-upload to server with matching version `1.0.1`

**Option B - Quick Test**:
1. Build launcher with version `1.0.2` in tauri.conf.json
2. Upload to server as version `1.0.2`
3. Old launcher (0.1.0) will update to 1.0.2
4. Should work properly

## Prevention

Always ensure the version in `tauri.conf.json` matches the version you're uploading to the server. The workflow should be:

1. Decide on new version (e.g., `1.2.0`)
2. Update `src-tauri/tauri.conf.json` → `"version": "1.2.0"`
3. Build the launcher
4. Upload to server with the **same** version `1.2.0`
5. Users on older versions will update correctly

