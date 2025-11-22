# VPN Integration Manual Testing Checklist

**Date**: 2025-11-22
**Tester**: _____________
**Platform**: _____________
**Build**: _____________

## Section 1: Compilation Tests

### Linux Compilation
- [ ] **Compile launcher on Linux without errors**
  - Command: `cd wowid3-launcher/src-tauri && cargo check`
  - Expected: No compilation errors (VPN module is Windows-only, should be excluded)
  - Notes: _______________

- [ ] **Compile server on Linux without errors**
  - Command: `cd wowid3-server/server && cargo check`
  - Expected: No compilation errors
  - Notes: _______________

### Windows Compilation
- [ ] **Compile launcher on Windows with Tauri dev**
  - Command: `cd wowid3-launcher && npm run tauri:dev`
  - Expected: Application builds and starts successfully
  - Notes: _______________

- [ ] **Verify VPN module compiles on Windows**
  - Command: `cd wowid3-launcher/src-tauri && cargo test --lib vpn`
  - Expected: VPN tests compile and run (may fail if WireGuard not installed, that's okay)
  - Notes: _______________

### Regression Testing
- [ ] **No regression in existing launcher tests**
  - Command: `cd wowid3-launcher/src-tauri && cargo test --lib`
  - Expected: All non-VPN tests pass as before
  - Notes: _______________

- [ ] **No regression in existing server tests**
  - Command: `cd wowid3-server/server && cargo test`
  - Expected: All tests pass as before
  - Notes: _______________

---

## Section 2: VPN Settings UI Tests

### Settings Screen Loading
- [ ] **Settings screen loads without errors**
  - Steps: Launch app → Navigate to Settings
  - Expected: Settings screen renders with no console errors
  - Notes: _______________

- [ ] **VPN toggle appears in Performance section**
  - Steps: Scroll to Performance section
  - Expected: "Use VPN Tunnel (reduces lag)" checkbox is visible
  - Notes: _______________

### Toggle Interaction
- [ ] **Toggle can be clicked on**
  - Steps: Click VPN toggle checkbox
  - Expected: Checkbox changes state (unchecked → checked)
  - Notes: _______________

- [ ] **Toggle can be clicked off**
  - Steps: Click VPN toggle checkbox again
  - Expected: Checkbox changes state (checked → unchecked)
  - Notes: _______________

- [ ] **VPN status indicator appears**
  - Steps: Enable VPN toggle
  - Expected: Status indicator appears below toggle (may show error if VPN not set up)
  - Notes: _______________

---

## Section 3: VPN Connection Tests (Windows Only)

**Prerequisites**: WireGuard installed on Windows test system

### Keypair Generation
- [ ] **Toggling VPN initiates keypair generation**
  - Steps: Enable VPN toggle in settings
  - Expected: Keypair generation happens in background (check console/logs)
  - Notes: _______________

- [ ] **Keypair is stored to filesystem**
  - Steps: Check `C:\ProgramData\wowid3-launcher\vpn\` directory
  - Expected: `private.key` and `public.key` files exist
  - Notes: _______________

- [ ] **Keypair files contain valid base64**
  - Steps: Open key files in text editor
  - Expected: 44-character base64 strings
  - Notes: _______________

### Tunnel Service
- [ ] **Verify tunnel service appears in Windows services** (if applicable)
  - Steps: Open `services.msc` → Look for `WireGuardTunnel$wowid3`
  - Expected: Service exists (or expected error if not yet implemented)
  - Notes: _______________

- [ ] **VPN status shows as connected/error**
  - Steps: Check status indicator after enabling VPN
  - Expected: Shows either "VPN Connected" (green) or error message (red)
  - Notes: _______________

---

## Section 4: Minecraft Launch Tests

### Direct Connection
- [ ] **Game launches via direct connection (VPN disabled)**
  - Steps: Disable VPN → Click Play
  - Expected: Minecraft launches and connects to `mc.frostdev.io:25565`
  - Notes: _______________

- [ ] **Server status ping uses direct address**
  - Steps: Disable VPN → Check server status widget
  - Expected: Shows server online/offline status, player count
  - Notes: _______________

### VPN Connection
- [ ] **Game launches via VPN (if tunnel active)**
  - Steps: Enable VPN → Ensure tunnel running → Click Play
  - Expected: Minecraft launches and attempts to connect via VPN (`10.8.0.1:25565`)
  - Notes: _______________

- [ ] **Server status ping uses VPN address**
  - Steps: Enable VPN → Check server status widget
  - Expected: Pings `10.8.0.1:25565` instead of public address
  - Notes: _______________

### Fallback Behavior
- [ ] **Proper fallback if VPN unavailable**
  - Steps: Enable VPN but ensure tunnel is NOT running → Click Play
  - Expected: Falls back to direct connection with warning message
  - Notes: _______________

---

## Section 5: Error Cases

### VPN Not Installed
- [ ] **VPN toggle shows error if WireGuard not installed**
  - Steps: Test on Windows system without WireGuard
  - Expected: Error message indicating WireGuard is required
  - Notes: _______________

- [ ] **Error message is user-friendly**
  - Expected: Clear instructions on how to install WireGuard
  - Notes: _______________

### Server Registration Failures
- [ ] **Clear error if VPN registration fails**
  - Steps: Attempt VPN registration with invalid auth token (if testable)
  - Expected: Specific error message about registration failure
  - Notes: _______________

### Tunnel Start Failures
- [ ] **Clear error if tunnel fails to start**
  - Steps: Attempt to start tunnel with invalid config
  - Expected: Error message explaining what went wrong
  - Notes: _______________

---

## Section 6: Admin Panel Tests (Server)

### VPN Peer Management
- [ ] **Admin can view list of VPN peers**
  - Steps: Login to admin panel → Navigate to VPN peers section
  - Expected: List of registered peers with UUIDs, usernames, IPs
  - Notes: _______________

- [ ] **Peer online status is accurate**
  - Steps: Check peer list while peers are connected
  - Expected: Green indicator for online peers, gray for offline
  - Notes: _______________

- [ ] **Admin can revoke a peer**
  - Steps: Click "Revoke" on a peer
  - Expected: Peer is removed from active list, WireGuard peer removed
  - Notes: _______________

---

## Summary

**Total Tests**: 30
**Passed**: ___
**Failed**: ___
**Skipped**: ___

### Critical Issues Found
1. _______________
2. _______________
3. _______________

### Non-Critical Issues Found
1. _______________
2. _______________
3. _______________

### Notes & Observations
_______________________________________________________________________________
_______________________________________________________________________________
_______________________________________________________________________________

### Sign-off

**Tester Signature**: _____________
**Date**: _____________
**Ready for Production**: [ ] Yes  [ ] No  [ ] With Fixes
