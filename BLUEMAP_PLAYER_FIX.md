# BlueMap Player Marker Fix

## Issue
Player markers not appearing in BlueMap viewer despite players being online on the server.

## Root Cause
The `write-players-interval` setting in BlueMap's `plugin.conf` was commented out, causing the default value of `0` to be used, which disables player data writing entirely.

## File Location
`/mnt/wowid3/config/bluemap/plugin.conf`

## Fix
Change line from:
```
#write-players-interval: 3
```

To:
```
write-players-interval: 3
```

This enables BlueMap to write player positions to `live/players.json` every 3 seconds.

## How to Apply
1. SSH to the Minecraft server (wowid3)
2. Edit the configuration file:
   ```bash
   nano /mnt/wowid3/config/bluemap/plugin.conf
   ```
3. Remove the `#` from the `write-players-interval` line
4. Save and exit
5. Reload BlueMap:
   - Option A: Use in-game command `/bluemap reload` (if you have permission)
   - Option B: Restart the Minecraft server

## Verification
After applying the fix, check that player data is being written:
```bash
cat /mnt/wowid3/bluemap/web/maps/world/live/players.json
```

Should show player data instead of empty `{}`:
```json
{
  "players": [
    {
      "uuid": "...",
      "name": "PlayerName",
      "world": "...",
      "position": {...},
      ...
    }
  ]
}
```

## Configuration Details
- **Default value**: `0` (disabled)
- **Recommended value**: `3` (update every 3 seconds)
- **Effect**: Controls how frequently player positions are written to the map storage
- **Related settings**:
  - `live-player-markers: true` - Must be enabled (already configured correctly)
  - `hidden-game-modes: ["spectator"]` - Players in spectator mode won't appear
  - `hide-vanished: true` - Vanished players won't appear
  - `hide-invisible: true` - Invisible players won't appear

## Date Fixed
2025-11-20

## Related Documentation
See `BLUEMAP_INTEGRATION.md` for complete BlueMap integration architecture.
