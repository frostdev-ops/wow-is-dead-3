# Update Modal Fix

The "New Release" modal was persisting after updates because of non-deterministic manifest hashing. The server was generating file lists in file-system order (using `WalkDir`), which can vary. This caused the client to calculate a different hash for the same manifest content if the order changed, leading it to believe the manifest had changed.

## Changes Implemented

### Client-Side (Launcher)
Modified `wowid3-launcher/src-tauri/src/modules/updater.rs` to sort files by path before calculating the manifest hash.
- **File**: `wowid3-launcher/src-tauri/src/modules/updater.rs`
- **Change**: Added `files.sort_by(|a, b| a.path.cmp(&b.path))` in `calculate_manifest_hash`.
- **Effect**: `has_manifest_changed` now returns `false` reliably after installation, causing the "New Release" modal to disappear as expected.

### Server-Side (Modpack Server)
Modified manifest generation to ensure deterministic `manifest.json` output.
- **Files**:
  - `wowid3-server/server/src/api/drafts.rs`: Sorts files before writing manifest when publishing drafts.
  - `wowid3-server/server/src/cli.rs`: Sorts files before writing manifest when regenerating via CLI.
- **Effect**: The server now produces stable, sorted manifest files, preventing unnecessary hash changes.

