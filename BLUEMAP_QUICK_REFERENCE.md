# BlueMap Integration - Quick Reference Guide

## TL;DR - Recommended Solution

**Use Method 1: Embedded Webview (Localhost)**

Why:
- Best user experience (integrated into launcher)
- Secure (localhost-only, no firewall issues)
- Real-time player/marker updates
- No new major dependencies needed
- ~4-6 hours implementation time

## System Architecture

```
Minecraft Server (running BlueMap plugin)
    ↓ Generates tiles, live data
BlueMap Web Server (port 8100, localhost-only)
    ↓ Serves HTTP endpoints
WOWID3 Launcher (Tauri app)
    └─ Webview Window loads http://localhost:8100
       └─ Displays BlueMap web UI
```

## Key Files & Locations

**On Minecraft Server:**
```
plugins/BlueMap/webserver.conf    # Configuration
plugins/BlueMap/maps/world.conf    # Per-world settings
bluemap/web/                       # Generated web files
bluemap/web/maps/{world}/tiles/    # Map tiles (PNG, PRBM)
bluemap/web/maps/{world}/live/     # Live data (players, markers)
```

**In WOWID3 Launcher:**
```
src-tauri/src/modules/map_viewer.rs        # Rust backend
src/hooks/useMapViewer.ts                  # React hook
src/components/MapViewerButton.tsx         # UI component
```

## Critical API Endpoints

| Endpoint | Purpose | Update Rate |
|----------|---------|------------|
| `http://localhost:8100/health` | Server health | N/A |
| `http://localhost:8100/maps/world/live/players.json` | Player positions | 1 sec |
| `http://localhost:8100/maps/world/live/markers.json` | Custom markers | 5-10 sec |
| `http://localhost:8100/maps/world/tiles/0/x{}/z{}.prbm` | Map geometry | On-demand |
| `http://localhost:8100/maps/world/config.json` | Map metadata | Static |

## Configuration

**Server-side** (`plugins/BlueMap/webserver.conf`):
```hocon
ip: "127.0.0.1"              # Localhost only (CRITICAL for security)
port: 8100                   # Default
enabled: true
liveUpdates: true            # Enable live player data
write-players-interval: 1000 # Update every 1 second
```

**Launcher-side** (no special config needed):
- Use `check_bluemap_available()` before opening
- Handle graceful failure if BlueMap not running
- Optional: Allow user to configure IP/port in settings

## Implementation Checklist

### Phase 1: Core Integration (Week 1)
- [ ] Create `src-tauri/src/modules/map_viewer.rs`
- [ ] Register commands in `src-tauri/src/lib.rs`
- [ ] Create `src/hooks/useMapViewer.ts`
- [ ] Create `src/components/MapViewerButton.tsx`
- [ ] Test locally with BlueMap running
- [ ] Handle error cases (BlueMap not running)

### Phase 2: Polish (Week 2)
- [ ] Integrate into Navigation/LauncherHome
- [ ] Add availability check on app startup
- [ ] Style to match launcher theme
- [ ] Test on Linux (X11 and Wayland)
- [ ] Add user-facing error messages

### Phase 3: Enhancement (Week 3+)
- [ ] Custom player markers integration
- [ ] Real-time player list syncing
- [ ] Marker management UI
- [ ] Performance optimization

## Code Snippets

### Rust: Check BlueMap Availability
```rust
#[tauri::command]
pub async fn check_bluemap_available() -> Result<bool, String> {
    match reqwest::Client::new()
        .get("http://localhost:8100/health")
        .timeout(Duration::from_secs(2))
        .send()
        .await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}
```

### Rust: Open BlueMap Window
```rust
#[tauri::command]
pub async fn open_map_viewer(handle: tauri::AppHandle) -> Result<(), String> {
    WebviewWindowBuilder::new(
        &handle,
        "bluemap",
        tauri::WebviewUrl::External("http://localhost:8100".parse().unwrap()),
    )
    .title("BlueMap - Server Map")
    .inner_size(1200.0, 800.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
```

### React: useMapViewer Hook
```typescript
import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback } from "react";

export function useMapViewer() {
  const [isBlueMapAvailable, setIsBlueMapAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async () => {
    try {
      const available = await invoke<boolean>("check_bluemap_available");
      setIsBlueMapAvailable(available);
    } catch (err) {
      setIsBlueMapAvailable(false);
    }
  }, []);

  const openMapViewer = useCallback(async () => {
    try {
      await invoke("open_map_viewer");
      setError(null);
    } catch (err) {
      setError(typeof err === "string" ? err : "Failed to open map");
    }
  }, []);

  return { isBlueMapAvailable, error, checkAvailability, openMapViewer };
}
```

### React: Button Component
```typescript
import { useMapViewer } from "../hooks/useMapViewer";
import { Button } from "./ui/Button";
import { useEffect } from "react";

export function MapViewerButton() {
  const { isBlueMapAvailable, openMapViewer, error, checkAvailability } = useMapViewer();

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  if (!isBlueMapAvailable) {
    return (
      <Button disabled title="BlueMap server not running">
        Map Unavailable
      </Button>
    );
  }

  return (
    <Button onClick={openMapViewer}>
      Open Server Map
    </Button>
  );
}
```

## Real-Time Player Updates (Advanced)

If you want live player data in launcher:

```typescript
import { useEffect, useState } from "react";

function useBlueMapPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:8100/maps/world/live/players.json");
        const data = await res.json();
        setPlayers(data.players || []);
      } catch (err) {
        console.error("Error fetching players:", err);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, []);

  return players;
}
```

## Platform-Specific Notes

### Linux (Wayland)
- Child webviews only work on X11
- Use separate window instead:
```rust
WebviewWindowBuilder::new(&handle, "bluemap", ...)
// Not as child webview
.build()
```

### Linux (X11)
- Works perfectly with child webviews
- No special configuration needed

### Windows & macOS
- Works out of the box
- No platform-specific issues

## Troubleshooting Checklist

| Problem | Check |
|---------|-------|
| "BlueMap not accessible" | Is plugin running? `/bluemap status` |
| Map shows but tiles black | Are chunks rendered? `/bluemap render` |
| Players not updating | Check `write-players-interval: 1000` in config |
| Window won't open (Linux) | Try X11: `GDK_BACKEND=x11 npm run tauri:dev` |
| CORS errors | Should not happen (localhost), check proxy setup |

## Security Considerations

**CRITICAL**: Always bind BlueMap to localhost only:
```hocon
ip: "127.0.0.1"  # NOT "0.0.0.0"
```

This ensures:
- No external access to map data
- No CORS needed
- Player information stays private
- No firewall holes

## Performance Tips

1. **Set reasonable update intervals** (don't set too low):
   - Players: 1000ms minimum recommended
   - Markers: 5000ms or higher

2. **Limit player polling** if using live player display:
   - Poll every 1-5 seconds, not faster
   - Debounce updates to avoid excessive re-renders

3. **Cache tile data** in browser:
   - BlueMap does this automatically
   - Tiles only refresh when chunks change

## Known Limitations

1. **No WebSocket support yet** in BlueMap
   - Uses HTTP polling instead
   - Feature request pending on GitHub issue #244

2. **Child webviews on Linux Wayland not supported**
   - Use separate window instead
   - Or force X11 with environment variable

3. **PRBM binary format not easily parseable**
   - Can't render tiles outside BlueMap UI
   - Stick with webview approach

4. **Markers not persisted by BlueMap**
   - Dynamic markers created via API require plugin-side persistence
   - Static markers in config files are persistent

## Resources

- **Full Documentation**: See `BLUEMAP_INTEGRATION_RESEARCH.md`
- **BlueMap Official Docs**: https://bluemap.bluecolored.de/
- **BlueMapAPI GitHub**: https://github.com/BlueMap-Minecraft/BlueMapAPI
- **Tauri Webview Docs**: https://v2.tauri.app/reference/javascript/api/namespacewebview/

## Implementation Timeline Estimate

| Phase | Time | Complexity |
|-------|------|-----------|
| Phase 1: Basic integration | 4-6 hours | Medium |
| Phase 2: Polish & testing | 2-3 hours | Low |
| Phase 3: Enhancement | 8-16 hours | High |
| **Total (Phase 1-2)** | **6-9 hours** | **Medium** |

## Next Steps

1. Review full documentation in `BLUEMAP_INTEGRATION_RESEARCH.md`
2. Verify BlueMap is properly configured on server
3. Start with Phase 1 implementation
4. Test availability check and window opening
5. Iterate on UI/UX improvements in Phase 2

---

**Last Updated**: November 19, 2025
**Research Completion**: Comprehensive (12+ sources)
