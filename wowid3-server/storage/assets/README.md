# Assets Directory

This directory contains static assets served by the launcher, such as audio files.

## Audio Files

Place the following audio files in this directory:

- `wid3menu.mp3` - Main launcher background music (full quality, ~26MB)
- `wid3menu-fallback.mp3` - Fallback preview music (optional, launcher has bundled version)

These files are served via the `/api/assets/:filename` endpoint and are used by the launcher's audio system.

## Security

Only whitelisted filenames can be served through this endpoint:
- `wid3menu.mp3`
- `wid3menu-fallback.mp3`

Any other files placed in this directory will not be accessible via the API.
