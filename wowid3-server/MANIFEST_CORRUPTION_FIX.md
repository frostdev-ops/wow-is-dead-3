# Manifest Corruption Issue and Permanent Fixes

## What Happened

The launcher was failing to update from version 1.0.2 to 1.0.3 with hash mismatch errors:
- **Expected hash**: `491d82fda6ac0463431571a1ea3b1c61c74aa22b2b959421c1afe2adda5f7f75`
- **Actual hash**: `d576b2b62521f2facdea2d32ea97496805f4c38361f0c34ed85718412a5888e0`

## Root Causes

### 1. Corrupted latest.json
- The `latest.json` file (which points to version 1.0.3) only had **5 files** instead of **1171 files**
- This was a truncated/partial write
- The checksums in the corrupted manifest were outdated/wrong

### 2. Why This Happened
- **Checksum mismatches**: Files were edited after checksums were calculated
  - When using `copy_release_to_draft` or `duplicate_draft`, old checksums were copied
  - When files were edited via FileBrowser, checksums weren't recalculated
  - When publishing, the old checksums were used instead of regenerating from disk

- **Non-atomic writes**: Manifests were written directly without atomic operations
  - If the write was interrupted (crash, OOM, etc.), partial files could be left
  - No validation before serving meant corrupted manifests were served to users

### 3. Timeline
Version 1.0.3 was published BEFORE we implemented the checksum regeneration fixes in:
- `duplicate_draft()` - now regenerates checksums after copying
- `copy_release_to_draft()` - now regenerates checksums after copying
- `publish_draft()` - now verifies checksums from disk before publishing

## Permanent Fixes Implemented

### Fix 1: Atomic Writes
**File**: `server/src/storage/manifest.rs`

All manifest writes now use atomic writes (temp file + rename):
```rust
async fn write_atomic(path: &PathBuf, content: String) -> Result<()> {
    let temp_path = path.with_extension("tmp");

    // Write to temp file
    fs::write(&temp_path, &content).await?;

    // Rename temp file to final path (atomic on Unix)
    fs::rename(&temp_path, path).await?;

    Ok(())
}
```

**Benefit**: Prevents partial/corrupted manifests from being written if the process crashes or is interrupted.

### Fix 2: Manifest Validation
**File**: `server/src/storage/manifest.rs`

All manifests are now validated before writing and before serving:
```rust
fn validate_manifest(manifest: &Manifest) -> Result<()> {
    // Check that manifest has files
    if manifest.files.is_empty() {
        anyhow::bail!("Manifest has no files - this is likely corrupted");
    }

    // Warn if file count is suspiciously low
    if manifest.files.len() < 10 {
        tracing::warn!("Manifest has only {} files - may be corrupted",
                      manifest.files.len());
    }

    // Validate all files have required fields
    for file in &manifest.files {
        if file.path.is_empty() { bail!("Empty path"); }
        if file.sha256.len() != 64 { bail!("Invalid SHA256"); }
        if file.url.is_empty() { bail!("Empty URL"); }
    }

    Ok(())
}
```

**Benefit**: Corrupted manifests are detected and rejected before being served to users.

### Fix 3: Pre-Publish Validation
**File**: `server/src/storage/manifest.rs`

The `set_latest_manifest()` function now validates before updating:
```rust
pub async fn set_latest_manifest(config: &Config, version: &str) -> Result<()> {
    let manifest = read_manifest(config, version).await?;

    // Validate manifest before setting as latest
    validate_manifest(&manifest)?;

    // Atomic write to prevent partial writes
    write_atomic(&latest_path, json).await?;

    Ok(())
}
```

**Benefit**: Ensures only valid, complete manifests are published as "latest".

### Fix 4: Checksum Regeneration (Already Implemented)
**Files**:
- `server/src/api/drafts.rs` - `duplicate_draft()`, `publish_draft()`
- `server/src/api/admin.rs` - `copy_release_to_draft()`

All functions that copy or publish now regenerate checksums from actual files on disk:
```rust
// Regenerate checksums from copied files instead of copying old checksums
let fresh_files = scan_directory_files(&dest_files_dir).await?;
```

**Benefit**: Checksums always match the actual files being served, even if files were edited after initial upload.

## How to Prevent This in the Future

### When Creating New Releases:
1. ✅ Checksums are automatically regenerated when duplicating or copying releases
2. ✅ Checksums are verified from disk before publishing
3. ✅ Manifests are validated before being set as latest
4. ✅ All writes are atomic (can't create partial files)

### When Editing Files via FileBrowser:
1. ✅ On publish, checksums are recalculated from disk (not from cached metadata)
2. ✅ Validation ensures all files have valid checksums before publishing

### Monitoring:
- Server logs now show warnings if manifests have suspiciously low file counts
- Validation errors are logged when corrupted manifests are detected
- Atomic write confirmations are logged

## Recovery Process Used

1. **Identified the issue**:
   - Hash mismatch errors in launcher logs
   - Discovered latest.json had only 5 files vs 1171 expected

2. **Regenerated manifests**:
   - Created script to walk all files and recalculate SHA256 checksums
   - Regenerated both 1.0.2 and 1.0.3 manifests
   - Updated latest.json to point to corrected 1.0.3 manifest

3. **Deployed fixes**:
   - Implemented atomic writes, validation, and pre-publish checks
   - Deployed updated server

## Verification

After fixes:
```bash
# Verify file hash on server
sha256sum /opt/wowid3-server/storage/releases/1.0.3/config/fancymenu/customization/drippy_loading_overlay_layout.txt
# d576b2b62521f2facdea2d32ea97496805f4c38361f0c34ed85718412a5888e0

# Verify hash in manifest
jq -r '.files[] | select(.path == "config/fancymenu/customization/drippy_loading_overlay_layout.txt") | .sha256' /opt/wowid3-server/storage/releases/1.0.3/manifest.json
# d576b2b62521f2facdea2d32ea97496805f4c38361f0c34ed85718412a5888e0

# Verify API serves correct hash
curl -s https://wowid-launcher.frostdev.io/api/manifest/latest | jq -r '.files[] | select(.path == "config/fancymenu/customization/drippy_loading_overlay_layout.txt") | .sha256'
# d576b2b62521f2facdea2d32ea97496805f4c38361f0c34ed85718412a5888e0
```

✅ All three match - launcher can now successfully update!

## Date
November 18, 2025
