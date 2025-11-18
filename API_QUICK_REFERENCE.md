# WOWID3 Launcher-Server API Quick Reference

## At-a-Glance Endpoint Summary

| Endpoint | Method | Purpose | Auth | Used By |
|----------|--------|---------|------|---------|
| `/api/manifest/latest` | GET | Get latest modpack manifest | None | Launcher (every 5 min) |
| `/api/manifest/:version` | GET | Get specific version manifest | None | Launcher (on-demand) |
| `/files/:version/*path` | GET | Download modpack files | None | Launcher (parallel) |
| `/api/java/:filename` | GET | Download Java runtime | None | Launcher (on startup) |
| `/health` | GET | Server health check | None | Infrastructure |

## Configuration Quick Start

### Server (.env file)
```bash
BASE_URL=https://wowid-launcher.frostdev.io
ADMIN_PASSWORD=changeme  # Change this!
STORAGE_PATH=../storage
API_PORT=8080
CORS_ORIGIN=              # Leave empty for production
```

### Launcher (settingsStore.ts)
```typescript
manifestUrl: 'https://wowid-launcher.frostdev.io/api/manifest/latest'
serverAddress: 'mc.frostdev.io:25565'  // Minecraft server (not modpack)
```

## Communication Flow

### 1. Update Check (Every 5 Minutes)
```
Launcher → GET /api/manifest/latest
    ↓
Parse manifest
    ↓
Compare with installed version
    ↓
If different: setUpdateAvailable(true)
```

### 2. Install/Update (Parallel Downloads)
```
For each file in manifest:
    → GET /files/:version/:path
    ↓
Stream to disk
    ↓
Verify SHA-256
    ↓
Emit progress event
```

### 3. Verify & Repair
```
Get files needing repair (same as delta update)
    ↓
Re-download all corrupted files
    ↓
Verify hashes match manifest
```

## Timeout Values

| Operation | Timeout | Behavior |
|-----------|---------|----------|
| Manifest fetch | 10 sec | Fail immediately |
| File download (connect) | 30 sec | Retry 3x with backoff |
| File download (read) | 300 sec (5 min) | Retry 3x with backoff |
| Server ping | 5 sec | Return offline |

## Retry Strategy

**Downloads Only (not manifests):**
- Max retries: 3
- Backoff: 1s, 2s, 4s (exponential)
- Triggers: Network error, HTTP 5xx, timeout
- Non-retryable: Hash mismatch, 4xx errors, disk errors

## Response Format

### Manifest Response
```json
{
  "version": "1.2.3",
  "minecraft_version": "1.20.1",
  "fabric_loader": "0.17.3",
  "changelog": "...",
  "files": [
    {
      "path": "mods/mod.jar",
      "url": "https://.../files/1.2.3/mods/mod.jar",
      "sha256": "abc123...",
      "size": 1048576
    }
  ]
}
```

### Error Response
```json
{
  "error": "Description of error"
}
```

## Common URLs

- **Default Base:** `https://wowid-launcher.frostdev.io`
- **Latest Manifest:** `https://wowid-launcher.frostdev.io/api/manifest/latest`
- **File Download:** `https://wowid-launcher.frostdev.io/files/1.2.3/mods/mod.jar`
- **Java Runtime:** `https://wowid-launcher.frostdev.io/api/java/zulu21-linux-x64.tar.gz`

## Concurrency Limits

Downloads are parallelized based on CPU cores:
- 1-2 cores: 15 concurrent
- 3-4 cores: 25 concurrent  
- 5-8 cores: 35 concurrent
- 9+ cores: 50 concurrent

## Security Features

- **Path Traversal Protection:** Files validated to be within release directory
- **Blacklist System:** Glob patterns prevent download of user data (saves, configs)
- **Hash Verification:** SHA-256 verified for all downloads
- **Whitelist for Java:** Only 4 platform-specific JRE files allowed
- **CORS:** Permissive in production, restrictable in dev

## Local Files Created

| File | Purpose |
|------|---------|
| `.wowid3-version` | Current installed version |
| `.wowid3-manifest-hash` | Hash of installed manifest |
| `java/` directory | Cached Java runtime |

## Testing with cURL

```bash
# Get latest manifest
curl -s "https://wowid-launcher.frostdev.io/api/manifest/latest" | jq

# Get specific version
curl -s "https://wowid-launcher.frostdev.io/api/manifest/1.2.3" | jq

# Download a file
curl -O "https://wowid-launcher.frostdev.io/files/1.2.3/mods/mod.jar"

# Download Java
curl -O "https://wowid-launcher.frostdev.io/api/java/zulu21-linux-x64.tar.gz"

# Health check
curl -s "https://wowid-launcher.frostdev.io/health" | jq
```

## Troubleshooting

| Problem | Check |
|---------|-------|
| `404` on manifest | BASE_URL correct? Manifest file exists in storage? |
| `403` on file download | Is file blacklisted? Check blacklist patterns. |
| `502` errors | Server crashed? Check logs, restart server. |
| Slow downloads | Network speed? Increase timeout in launcher settings. |
| Hash mismatches | Corrupted files? Use "Verify & Repair" feature. |

## Related Code Files

**Server-side:**
- `/server/src/api/public.rs` - All public endpoints
- `/server/src/main.rs` - Routing and CORS setup
- `/server/src/config.rs` - Configuration loading
- `/server/src/models/manifest.rs` - Manifest structure

**Launcher-side:**
- `/src-tauri/src/modules/updater.rs` - Manifest fetching and installation
- `/src-tauri/src/modules/download_manager.rs` - Download logic and retries
- `/src/hooks/useModpack.ts` - React hook for modpack operations
- `/src/stores/settingsStore.ts` - Settings including manifest URL

