# Quick Reference: Minecraft Installation API

## Commands Cheat Sheet

```typescript
// 1. List all Minecraft versions
const versions = await invoke<VersionInfo[]>('cmd_list_minecraft_versions', {
  versionType: 'release' // or 'snapshot' or null
});

// 2. Get latest release
const latest = await invoke<string>('cmd_get_latest_release');

// 3. Get Fabric loaders for a version
const loaders = await invoke<FabricLoader[]>('cmd_get_fabric_loaders', {
  gameVersion: '1.20.1'
});

// 4. Install Minecraft (vanilla)
await invoke('cmd_install_minecraft', {
  config: {
    game_version: '1.20.1',
    game_dir: '/path/to/minecraft'
  }
});

// 5. Install Minecraft (Fabric)
await invoke('cmd_install_minecraft', {
  config: {
    game_version: '1.20.1',
    fabric_version: '0.18.0',
    game_dir: '/path/to/minecraft'
  }
});

// 6. Check if installed
const isInstalled = await invoke<boolean>('cmd_is_version_installed', {
  gameDir: '/path/to/minecraft',
  versionId: '1.20.1'
});

// 7. Launch game
await invoke('cmd_launch_game_with_metadata', {
  config: {
    ram_mb: 4096,
    game_dir: '/path/to/minecraft',
    username: 'Player',
    uuid: 'uuid-here',
    access_token: 'token-here'
  },
  versionId: '1.20.1' // or 'fabric-loader-0.18.0-1.20.1'
});
```

## Event Listener

```typescript
const unlisten = await listen<InstallProgress>('minecraft-install-progress', (event) => {
  const { step, current, total, message } = event.payload;
  console.log(`${message}: ${current}/${total}`);
});
```

## TypeScript Types

```typescript
interface VersionInfo {
  id: string;
  version_type: string;
  url: string;
  time: string;
  release_time: string;
}

interface FabricLoader {
  build: number;
  maven: string;
  version: string;
  stable: boolean;
}

interface InstallConfig {
  game_version: string;
  fabric_version?: string;
  game_dir: string;
}

interface InstallProgress {
  step: string;
  current: number;
  total: number;
  message: string;
}

interface LaunchConfig {
  ram_mb: number;
  java_path?: string;
  game_dir: string;
  username: string;
  uuid: string;
  access_token: string;
}
```

## Installation Steps

Progress event `step` values in order:
1. `version_meta` - Fetching version metadata
2. `fabric` - Installing Fabric (if enabled)
3. `client` - Downloading client JAR
4. `libraries` - Downloading libraries
5. `assets` - Downloading assets (longest step, ~2-5 min)
6. `complete` - Installation finished

## Version ID Format

- **Vanilla**: Just the version number (e.g., `1.20.1`)
- **Fabric**: `fabric-loader-{loader_version}-{game_version}`
  - Example: `fabric-loader-0.18.0-1.20.1`

## Common Errors

| Error Contains | Cause | Solution |
|----------------|-------|----------|
| `Failed to fetch` | Network error | Check internet connection |
| `SHA1 mismatch` | Corrupted download | Retry installation |
| `not found in manifest` | Invalid version | Check version exists in list |
| `No space left` | Disk full | Free up ~500MB space |

## File Sizes Reference

- Vanilla Minecraft: ~50MB libraries + ~300MB assets = ~350MB total
- Fabric adds: ~5-10MB additional libraries
- Installation requires ~500MB free disk space (including temp files)

## Performance Notes

- Version list fetch: < 1 second
- Fabric loaders fetch: < 1 second
- Installation time:
  - Libraries: 30 seconds - 2 minutes (depends on network)
  - Assets: 2-5 minutes (4000+ small files)
  - Total: 3-7 minutes typical
