# Fabric Server Egg - Fix Changelog

## Date: 2025-11-18

## Critical Issues Fixed

### 🔴 CRITICAL: Container/Package Manager Mismatch
**Issue**: Egg specified Alpine Linux container but used Debian `apt` commands
- **Before**: `ghcr.io/pterodactyl/installers:alpine` with `ash` entrypoint
- **After**: `ghcr.io/pterodactyl/installers:debian` with `bash` entrypoint
- **Impact**: Installation would fail immediately with "apt: command not found"

### 🟠 HIGH: Variable Naming Standardization
**Issue**: Variable naming was backwards from Pterodactyl/Pelican standards

**Before**:
- `FABRIC_VERSION` = Fabric Loader Version (0.17.3)
- `INSTALLER_VERSION` = Fabric Installer Version (1.1.0)
- Missing: `LOADER_VERSION`

**After**:
- `FABRIC_VERSION` = Fabric Installer Version (default: "latest")
- `LOADER_VERSION` = Fabric Loader Version (default: "latest")
- Follows official Pelican egg naming conventions

### 🟡 MEDIUM: Java Version Support
**Issue**: Only Java 17 and 21 were available

**Before**: Java 17, 21
**After**: Java 8, 11, 16, 17, 18, 21

Now supports legacy mods requiring older Java versions.

### 🟡 MEDIUM: Overly Permissive File Permissions
**Issue**: Script used chmod 777/666 on all files and directories

**Before**:
```bash
chmod 777 .
chmod -R 777 mods config world logs kubejs .fabric
chmod 666 eula.txt server.properties
```

**After**: Removed all explicit chmod commands (Pterodactyl handles permissions)

## Enhancements Added

### Version Resolution Logic
Added automatic version resolution for "latest" and "snapshot" values:

```bash
# Supports:
MC_VERSION: "latest" | "snapshot" | specific version
FABRIC_VERSION: "latest" | specific version
LOADER_VERSION: "latest" | "snapshot" | specific version
```

### Additional Dependencies
Added `jq` package installation for JSON parsing in version resolution.

### Improved Installation Logging
- Clear indication of version resolution steps
- Better error messages with context
- Organized configuration summary output

## Features Preserved

✅ Advanced G1GC JVM tuning for modded servers
✅ MaxRAMPercentage memory management (95%)
✅ Comprehensive directory structure (kubejs, .fabric, etc.)
✅ Direct JAR download method (faster than installer approach)
✅ Automatic EULA acceptance
✅ Default server.properties creation

## Migration Notes

### For Existing Servers
If you have existing servers using the old egg:

1. **Variable Changes**: The variable names have changed
   - Old `FABRIC_VERSION` (loader) → New `LOADER_VERSION`
   - Old `INSTALLER_VERSION` → New `FABRIC_VERSION`

2. **Default Values**: Defaults now use "latest" instead of specific versions
   - This means servers will auto-update to latest versions on reinstall
   - If you want specific versions, set them explicitly

3. **Java Versions**: More options available (8, 11, 16, 18)
   - Can now support older mods requiring Java 8 or 11

### Recommended Actions

1. Review your server's current Fabric versions before reinstalling
2. If using specific versions, explicitly set them in the egg variables
3. Test the installation in a development environment first
4. Backup your server data before applying the updated egg

## API Endpoint

The egg now correctly constructs the Fabric API URL:
```
https://meta.fabricmc.net/v2/versions/loader/{MC_VERSION}/{LOADER_VERSION}/{FABRIC_VERSION}/server/jar
```

Where:
- `MC_VERSION` = Minecraft version (e.g., 1.20.1)
- `LOADER_VERSION` = Fabric loader version (e.g., 0.17.3)
- `FABRIC_VERSION` = Fabric installer version (e.g., 1.1.0)

## Testing Checklist

- [x] JSON syntax validation (jq)
- [x] Variable naming consistency
- [x] Container and entrypoint compatibility
- [ ] Test installation with "latest" versions
- [ ] Test installation with specific versions
- [ ] Test with different Java versions
- [ ] Verify mods can be uploaded and loaded
- [ ] Verify server starts correctly

## References

- Official Pelican Fabric Egg: https://github.com/pelican-eggs/minecraft/blob/main/java/fabric/egg-fabric.json
- Fabric Meta API: https://meta.fabricmc.net/
- Fabric Documentation: https://fabricmc.net/
