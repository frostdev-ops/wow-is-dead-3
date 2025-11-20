# CRITICAL BUG FIX: .wowid3-version File Being Deleted

**Date**: 2025-11-20  
**Severity**: 🔴 **CRITICAL** - Causes launcher to lose track of installed modpack  
**Status**: ✅ **FIXED**

---

## Problem

The launcher showed "Modpack: Not installed" even though the modpack files were actually installed on disk.

---

## Root Cause

The `cleanup_extra_files()` function in `updater.rs` was deleting the `.wowid3-version` file during the cleanup phase!

### The Deadly Sequence

1. User installs/updates modpack
2. Files are downloaded successfully
3. **`cleanup_extra_files()` runs** to remove files not in manifest
4. `.wowid3-version` is NOT in the manifest (it's a meta file)
5. `.wowid3-version` is NOT in server's `ignore_patterns` (if server doesn't include it)
6. **File gets deleted!** 💥
7. `update_version_file()` runs AFTER cleanup and recreates it
8. BUT: If anything goes wrong or the cleanup runs again later (verify/repair), the file disappears again

### Why This Went Unnoticed

- The file IS created at the end of installation
- But verify/repair operations run cleanup again
- Background verification was running on every app launch
- Each time, it would delete and recreate the file
- If recreation failed for any reason, the file stayed deleted
- Result: Launcher loses track of installed version

---

## The Fix

### 1. Protected Meta Files from Cleanup

Added hardcoded protection in `cleanup_extra_files()`:

```rust
// CRITICAL: Never delete launcher meta files
if relative_path == ".wowid3-version" || relative_path == ".wowid3-manifest-hash" {
    kept_count += 1;
    continue;
}
```

**Location**: `wowid3-launcher/src-tauri/src/modules/updater.rs` line ~310

### 2. Don't Overwrite Valid Version with Null

Modified `useModpack` to preserve store value if disk check returns null:

```typescript
if (version) {
  setInstalledVersion(version);
} else if (!installedVersion) {
  setInstalledVersion(null);
} else {
  // File missing but store has version - keep it!
  logger.warn('⚠️ .wowid3-version file missing, but store has version - keeping store value');
}
```

**Location**: `wowid3-launcher/src/hooks/useModpack.ts`

### 3. Disabled Automatic Install Logic

Removed the automatic install/verify effect that was running on every state change:

**Location**: `wowid3-launcher/src/hooks/useModpackLifecycle.ts`  
**Reason**: Prevents unnecessary verify/cleanup operations that could delete the file

---

## Impact

### Before Fix
- ❌ `.wowid3-version` file gets deleted during cleanup/verify operations
- ❌ Launcher shows "Not installed" even when modpack exists
- ❌ User confusion and potential re-downloads
- ❌ State inconsistency between disk and UI

### After Fix
- ✅ `.wowid3-version` protected from deletion
- ✅ Launcher correctly shows installed version
- ✅ Store preserves version even if file temporarily missing
- ✅ UI matches actual state

---

## Additional Tauri Command Added

Created `cmd_set_installed_version` to manually update the version file if needed:

```rust
#[tauri::command]
async fn cmd_set_installed_version(game_dir: PathBuf, version: String) -> Result<String, String> {
    update_version_file(&game_dir, &version)
        .await
        .map(|_| format!("Version file updated to {}", version))
        .map_err(|e| e.to_string())
}
```

This allows recovery if the file gets corrupted or deleted.

---

## Testing

### Verification Steps

1. ✅ Install modpack
2. ✅ Check `.wowid3-version` exists: `ls ~/.local/share/com.wowid3.launcher/game/.wowid3-version`
3. ✅ Run verify/repair operation
4. ✅ Confirm file still exists after cleanup
5. ✅ Navigate between tabs
6. ✅ Confirm version still shows correctly

### Expected Behavior

- Version file persists through all operations
- Launcher always shows correct installed version
- No "Not installed" errors when modpack exists

---

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| `src-tauri/src/modules/updater.rs` | Protected meta files from cleanup | Prevent deletion |
| `src-tauri/src/lib.rs` | Added `cmd_set_installed_version` | Manual recovery tool |
| `src/hooks/useModpack.ts` | Don't overwrite valid version with null | Preserve state |
| `src/hooks/useModpackLifecycle.ts` | Disabled auto-install effect | Reduce unnecessary operations |

---

## Lessons Learned

1. **Meta files need explicit protection**: Files used for state tracking must be protected from cleanup operations
2. **Cleanup order matters**: Create meta files BEFORE cleanup, not after
3. **Defensive programming**: Don't blindly overwrite good state with bad data
4. **Server responsibility**: Server should include `.wowid3-*` in ignore patterns as defense-in-depth

---

## Recommended Server-Side Fix

The modpack server should include these patterns in `ignore_patterns`:

```json
{
  "ignore_patterns": [
    ".wowid3-version",
    ".wowid3-manifest-hash",
    "logs/",
    "crash-reports/",
    "screenshots/",
    "saves/",
    "config/"
  ]
}
```

This provides defense-in-depth even though we now protect these files in code.

---

## Status

✅ **FIXED** and **TESTED**

The launcher now correctly maintains version tracking even through multiple verify/repair cycles.



