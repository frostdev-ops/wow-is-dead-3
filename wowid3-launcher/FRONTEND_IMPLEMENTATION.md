# Frontend Implementation Guide: Minecraft Installation System

## Overview

The Rust backend now provides a complete Minecraft installation system with support for vanilla and Fabric versions. This document outlines all frontend changes needed to integrate this system.

---

## New Tauri Commands

### 1. Version Management

#### `cmd_list_minecraft_versions`
Get all available Minecraft versions.

```typescript
interface VersionInfo {
  id: string;              // "1.20.1"
  version_type: string;    // "release" or "snapshot"
  url: string;
  time: string;
  release_time: string;
}

// Usage
const versions = await invoke<VersionInfo[]>('cmd_list_minecraft_versions', {
  versionType: 'release' // Optional: 'release', 'snapshot', or null for all
});
```

#### `cmd_get_latest_release`
Get the latest release version ID.

```typescript
const latestVersion = await invoke<string>('cmd_get_latest_release');
// Returns: "1.21.10"
```

#### `cmd_get_latest_snapshot`
Get the latest snapshot version ID.

```typescript
const latestSnapshot = await invoke<string>('cmd_get_latest_snapshot');
// Returns: "24w51a"
```

---

### 2. Fabric Loader Management

#### `cmd_get_fabric_loaders`
Get all Fabric loader versions for a specific game version.

```typescript
interface FabricLoader {
  separator?: string;  // Optional: "."
  build: number;       // Build number
  maven: string;       // Maven coordinates
  version: string;     // "0.18.0"
  stable: boolean;     // Is this a stable release?
}

// Usage
const loaders = await invoke<FabricLoader[]>('cmd_get_fabric_loaders', {
  gameVersion: '1.20.1'
});
```

#### `cmd_get_latest_fabric_loader`
Get the latest stable Fabric loader for a game version.

```typescript
const loader = await invoke<FabricLoader>('cmd_get_latest_fabric_loader', {
  gameVersion: '1.20.1'
});
```

---

### 3. Installation Commands

#### `cmd_install_minecraft`
Install Minecraft (vanilla or with Fabric).

```typescript
interface InstallConfig {
  game_version: string;      // "1.20.1"
  fabric_version?: string;   // Optional: "0.18.0" (omit for vanilla)
  game_dir: string;          // Absolute path to game directory
}

// Usage - Vanilla
await invoke('cmd_install_minecraft', {
  config: {
    game_version: '1.20.1',
    game_dir: '/path/to/minecraft'
  }
});

// Usage - Fabric
await invoke('cmd_install_minecraft', {
  config: {
    game_version: '1.20.1',
    fabric_version: '0.18.0',
    game_dir: '/path/to/minecraft'
  }
});
```

**Progress Events**: Listen for `minecraft-install-progress` event (see Events section).

#### `cmd_is_version_installed`
Check if a specific version is already installed.

```typescript
const isInstalled = await invoke<boolean>('cmd_is_version_installed', {
  gameDir: '/path/to/minecraft',
  versionId: 'fabric-loader-0.18.0-1.20.1' // or '1.20.1' for vanilla
});
```

---

### 4. Game Launch (Updated)

#### `cmd_launch_game_with_metadata`
Launch Minecraft using the new metadata system (supports vanilla and Fabric).

```typescript
interface LaunchConfig {
  ram_mb: number;           // RAM allocation in MB (e.g., 4096)
  java_path?: string;       // Optional: custom Java path
  game_dir: string;         // Game directory path
  username: string;         // Minecraft username
  uuid: string;             // Player UUID
  access_token: string;     // Minecraft access token
}

// Usage
await invoke('cmd_launch_game_with_metadata', {
  config: {
    ram_mb: 4096,
    game_dir: '/path/to/minecraft',
    username: 'Player',
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    access_token: 'token_here'
  },
  versionId: 'fabric-loader-0.18.0-1.20.1' // or '1.20.1' for vanilla
});
```

**Note**: The existing `cmd_launch_game` still works but is legacy. Use `cmd_launch_game_with_metadata` for new implementations.

---

## Event Listeners

### Installation Progress Event

```typescript
interface InstallProgress {
  step: string;      // "version_meta" | "fabric" | "client" | "libraries" | "assets" | "complete"
  current: number;   // Current progress
  total: number;     // Total items
  message: string;   // Human-readable message
}

// Listen for progress updates
const unlisten = await listen<InstallProgress>('minecraft-install-progress', (event) => {
  const { step, current, total, message } = event.payload;

  console.log(`[${step}] ${message}: ${current}/${total}`);

  // Update UI progress bar
  const percentage = (current / total) * 100;
  setProgress(percentage);
  setProgressMessage(message);
});

// Don't forget to unlisten when component unmounts
onCleanup(() => unlisten());
```

### Existing Game Events

These events still work as before:

- `minecraft-log` - Game output logs
- `minecraft-exit` - Game process exit
- `minecraft-crash` - Crash analysis results

---

## Recommended UI Flows

### 1. Initial Setup Flow

```
┌─────────────────────────────────┐
│  Check if Minecraft installed   │
│  cmd_is_version_installed()     │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┐
      │             │
    [Yes]         [No]
      │             │
      │      ┌──────▼──────────────────┐
      │      │  Show Version Selector  │
      │      │  cmd_list_minecraft_    │
      │      │  versions()              │
      │      └──────┬──────────────────┘
      │             │
      │      ┌──────▼──────────────────┐
      │      │  Fabric Toggle?         │
      │      │  If yes: cmd_get_fabric_│
      │      │  loaders()               │
      │      └──────┬──────────────────┘
      │             │
      │      ┌──────▼──────────────────┐
      │      │  Install Button         │
      │      │  cmd_install_minecraft()│
      │      │  + progress listener     │
      │      └──────┬──────────────────┘
      │             │
      └─────────────┴────────────────────┐
                                         │
                                  ┌──────▼──────┐
                                  │  Play Button │
                                  └─────────────┘
```

### 2. Version Selector Component

**Purpose**: Let users choose Minecraft version and optionally Fabric loader.

**State Needed**:
- `minecraftVersions: VersionInfo[]`
- `selectedVersion: string`
- `enableFabric: boolean`
- `fabricLoaders: FabricLoader[]`
- `selectedFabricLoader: string`
- `isLoading: boolean`

**Actions**:
1. On mount: Fetch versions with `cmd_list_minecraft_versions({ versionType: 'release' })`
2. On version select: If Fabric enabled, fetch loaders with `cmd_get_fabric_loaders()`
3. On Fabric toggle: Load Fabric loaders for selected version
4. On install click: Call `cmd_install_minecraft()` with config

### 3. Installation Progress Component

**Purpose**: Show installation progress with detailed steps.

**State Needed**:
- `isInstalling: boolean`
- `currentStep: string`
- `progress: number` (0-100)
- `progressMessage: string`
- `error: string | null`

**Progress Steps to Display**:
- `version_meta` → "Fetching version metadata..."
- `fabric` → "Installing Fabric loader..."
- `client` → "Downloading Minecraft client..."
- `libraries` → "Downloading libraries..."
- `assets` → "Downloading assets..." (this takes longest)
- `complete` → "Installation complete!"

**UI Recommendations**:
- Show overall progress bar
- Show current step name
- Show detailed message
- Disable install button while installing
- Show estimated time (assets can take 2-5 minutes)

### 4. Launch Flow Updates

**Update Existing Launch Logic**:

```typescript
// OLD (still works but legacy)
await invoke('cmd_launch_game', { config });

// NEW (recommended)
const versionId = enableFabric
  ? `fabric-loader-${fabricVersion}-${minecraftVersion}`
  : minecraftVersion;

await invoke('cmd_launch_game_with_metadata', {
  config: {
    ram_mb: settings.ramMb,
    game_dir: settings.gameDir,
    username: user.username,
    uuid: user.uuid,
    access_token: user.accessToken
  },
  versionId
});
```

---

## State Management Recommendations

### New Stores/Hooks Needed

#### `useMinecraftInstaller` Hook

```typescript
interface UseMinecraftInstaller {
  // Version management
  versions: VersionInfo[];
  selectedVersion: string;
  setSelectedVersion: (version: string) => void;

  // Fabric management
  fabricEnabled: boolean;
  setFabricEnabled: (enabled: boolean) => void;
  fabricLoaders: FabricLoader[];
  selectedFabricLoader: string;
  setSelectedFabricLoader: (version: string) => void;

  // Installation state
  isInstalled: boolean;
  isInstalling: boolean;
  installProgress: InstallProgress | null;
  error: string | null;

  // Actions
  loadVersions: () => Promise<void>;
  loadFabricLoaders: (gameVersion: string) => Promise<void>;
  install: () => Promise<void>;
  checkInstalled: (versionId: string) => Promise<boolean>;
}
```

#### Installation Settings Store

```typescript
interface InstallationSettings {
  gameDir: string;              // Where to install Minecraft
  defaultVersion: string;       // Default Minecraft version
  autoUpdate: boolean;          // Auto-update when new version available
  preferStableFabric: boolean;  // Only show stable Fabric versions
}
```

---

## Error Handling

### Common Errors to Handle

```typescript
try {
  await invoke('cmd_install_minecraft', { config });
} catch (error) {
  // Network errors
  if (error.includes('Failed to fetch')) {
    showError('Network error. Check your internet connection.');
  }
  // Disk space errors
  else if (error.includes('No space left')) {
    showError('Insufficient disk space. Need ~500MB free.');
  }
  // SHA1 mismatch (corrupted download)
  else if (error.includes('SHA1 mismatch')) {
    showError('Download corrupted. Please try again.');
  }
  // Version not found
  else if (error.includes('not found in manifest')) {
    showError('Minecraft version not available.');
  }
  // Generic error
  else {
    showError(`Installation failed: ${error}`);
  }
}
```

---

## Example Component (React/TypeScript)

```typescript
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface InstallProgress {
  step: string;
  current: number;
  total: number;
  message: string;
}

export function MinecraftInstaller() {
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [fabricEnabled, setFabricEnabled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState<InstallProgress | null>(null);

  useEffect(() => {
    // Load available versions
    invoke<{ id: string }[]>('cmd_list_minecraft_versions', {
      versionType: 'release'
    }).then(data => {
      const versionIds = data.map(v => v.id);
      setVersions(versionIds);
      setSelectedVersion(versionIds[0]);
    });

    // Listen for installation progress
    const unlisten = listen<InstallProgress>('minecraft-install-progress', (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleInstall = async () => {
    try {
      setIsInstalling(true);

      const config = {
        game_version: selectedVersion,
        fabric_version: fabricEnabled ? await getLatestFabricVersion() : undefined,
        game_dir: '/path/to/minecraft' // Get from settings
      };

      await invoke('cmd_install_minecraft', { config });

      alert('Installation complete!');
    } catch (error) {
      alert(`Installation failed: ${error}`);
    } finally {
      setIsInstalling(false);
      setProgress(null);
    }
  };

  const getLatestFabricVersion = async () => {
    const loader = await invoke<{ version: string }>('cmd_get_latest_fabric_loader', {
      gameVersion: selectedVersion
    });
    return loader.version;
  };

  return (
    <div>
      <h2>Install Minecraft</h2>

      <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
        {versions.map(v => <option key={v} value={v}>{v}</option>)}
      </select>

      <label>
        <input
          type="checkbox"
          checked={fabricEnabled}
          onChange={(e) => setFabricEnabled(e.target.checked)}
        />
        Install with Fabric
      </label>

      <button onClick={handleInstall} disabled={isInstalling}>
        {isInstalling ? 'Installing...' : 'Install'}
      </button>

      {progress && (
        <div>
          <p>{progress.message}</p>
          <progress value={progress.current} max={progress.total} />
          <span>{Math.round((progress.current / progress.total) * 100)}%</span>
        </div>
      )}
    </div>
  );
}
```

---

## Testing Checklist

Frontend developer should verify:

- [ ] Version list loads correctly
- [ ] Latest version is selected by default
- [ ] Fabric toggle shows/hides Fabric version selector
- [ ] Install progress updates smoothly
- [ ] Installation completes successfully (vanilla)
- [ ] Installation completes successfully (Fabric)
- [ ] Installed version check works
- [ ] Game launches with correct version ID
- [ ] Error messages display properly
- [ ] Progress listener cleanup on unmount
- [ ] Installation can be retried after failure
- [ ] Multiple versions can be installed side-by-side

---

## File Structure Recommendations

```
src/
├── hooks/
│   ├── useMinecraftVersions.ts    [NEW]
│   ├── useFabricLoaders.ts        [NEW]
│   ├── useMinecraftInstaller.ts   [NEW]
│   └── useTauriCommands.ts        [UPDATE - add new commands]
│
├── components/
│   ├── installer/
│   │   ├── VersionSelector.tsx    [NEW]
│   │   ├── FabricToggle.tsx       [NEW]
│   │   ├── InstallProgress.tsx    [NEW]
│   │   └── InstallButton.tsx      [NEW]
│   └── LauncherHome.tsx           [UPDATE - check installation status]
│
├── stores/
│   ├── installerStore.ts          [NEW]
│   └── settingsStore.ts           [UPDATE - add game_dir setting]
│
└── types/
    └── minecraft.ts                [NEW - TypeScript interfaces]
```

---

## Migration Notes

### Breaking Changes
- None! All existing commands still work.

### Recommended Changes
1. Replace `cmd_launch_game` with `cmd_launch_game_with_metadata` for better compatibility
2. Add version installation check before showing "Play" button
3. Add installation UI for first-time users
4. Store selected Minecraft version in settings

### Backward Compatibility
- Existing launcher code will continue to work
- Old `cmd_launch_game` is maintained for compatibility
- New system runs alongside existing modpack system

---

## Support & Troubleshooting

### Common Issues

**"Version not found" error**:
- Ensure `game_dir` path is absolute, not relative
- Check that version exists in manifest (`cmd_list_minecraft_versions`)

**Installation hangs on assets**:
- This is normal! Assets can take 2-5 minutes (4000+ files)
- Progress events will continue updating

**Launch fails with "version not installed"**:
- Check version ID matches exactly (case-sensitive)
- For Fabric: `fabric-loader-{loader_version}-{game_version}`
- For vanilla: Just the game version (e.g., `1.20.1`)

**SHA1 mismatch errors**:
- Network interruption during download
- Click install again to retry

---

## Questions?

Contact the backend team with:
- Which Tauri command you're using
- Full error message from backend
- Steps to reproduce the issue
- Expected vs actual behavior
