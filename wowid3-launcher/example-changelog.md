# Version 1.2.3 - Winter Wonderland Update

## New Features
- Added Christmas themed background with animated falling snow
- Added background music player with mute toggle control
- Added version display badge with hover changelog preview
- Added click-to-view full changelog modal
- Added inline Minecraft installation UI on home screen
- Added real-time installation progress tracking with detailed steps

## Improvements
- Improved Settings page styling to match Christmas theme
- Improved navigation with top-left icon-based buttons
- Improved user authentication flow with clearer status indicators
- Improved error handling with user-friendly toast notifications
- Improved modpack update detection and automatic installation

## Bug Fixes
- Fixed player model positioning - now properly sits and is uninteractable
- Fixed cat model positioning for better visual balance
- Fixed HMR file watching to ignore Minecraft installation directories
- Fixed Discord Rich Presence connection handling
- Fixed authentication token refresh with 5-minute buffer

## Changes
- Navigation buttons moved to top-left corner with icon design
- Minecraft installation moved from Settings to home screen
- Stats card now shows both modpack and Minecraft installation status
- Theme settings removed - Christmas theme is now permanent
- Background music set to 30% volume by default

## Technical
- Updated to Tauri 2.x with full Wayland support
- Implemented complete Minecraft version management system
- Added Fabric mod loader integration with version selection
- Implemented SHA-1 verification for all downloads
- Added parallel download support (10 concurrent connections)
- Implemented asset management with 4000+ file handling
- Added library management with native extraction support

## Known Issues
- Asset downloads may take 2-5 minutes on first installation
- WebKit DMABUF renderer issues on NVIDIA systems (workaround applied)

---

For more information, visit: https://wowid-launcher.frostdev.io
