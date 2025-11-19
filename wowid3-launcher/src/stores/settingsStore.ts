import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { homeDir } from '@tauri-apps/api/path';

interface SettingsState {
  // Java settings
  javaPath: string | null;
  ramAllocation: number; // in MB

  // Game settings
  gameDirectory: string;
  serverAddress: string;

  // Internal state
  _defaultGameDirectoryFetched: boolean;

  // Minecraft Installation settings
  minecraftVersion: string | null;      // Preferred Minecraft version
  fabricEnabled: boolean;                // Whether to use Fabric by default
  fabricVersion: string | null;          // Preferred Fabric loader version
  autoUpdate: boolean;                   // Auto-update when new version available
  preferStableFabric: boolean;           // Only show stable Fabric versions
  isMinecraftInstalled: boolean;         // Whether Minecraft is installed

  // Launcher settings
  theme: 'christmas' | 'dark' | 'light';
  manifestUrl: string;
  keepLauncherOpen: boolean; // Show log viewer instead of minimizing
  musicWasPaused: boolean; // Track if music was paused before game launch

  // Actions
  setJavaPath: (path: string | null) => void;
  setRamAllocation: (ram: number) => void;
  setGameDirectory: (dir: string) => void;
  setServerAddress: (address: string) => void;
  setMinecraftVersion: (version: string | null) => void;
  setFabricEnabled: (enabled: boolean) => void;
  setFabricVersion: (version: string | null) => void;
  setAutoUpdate: (enabled: boolean) => void;
  setPreferStableFabric: (enabled: boolean) => void;
  setIsMinecraftInstalled: (installed: boolean) => void;
  setTheme: (theme: 'christmas' | 'dark' | 'light') => void;
  setManifestUrl: (url: string) => void;
  setKeepLauncherOpen: (keep: boolean) => void;
  setMusicWasPaused: (paused: boolean) => void;
  initializeGameDirectory: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Defaults
      javaPath: null, // Will use bundled Java
      ramAllocation: 16384, // 16GB default
      gameDirectory: '', // Will be set by initializeGameDirectory()
      serverAddress: 'mc.frostdev.io:25565',
      _defaultGameDirectoryFetched: false,
      minecraftVersion: '1.20.1', // Default from modpack requirements
      fabricEnabled: true, // Always enabled for WOWID3 modpack
      fabricVersion: '0.17.3', // Default from modpack requirements
      autoUpdate: false,
      preferStableFabric: true,
      isMinecraftInstalled: false, // Will be checked on startup
      theme: 'christmas',
      manifestUrl: 'https://wowid-launcher.frostdev.io/api/manifest/latest',
      keepLauncherOpen: false, // Default to minimize launcher
      musicWasPaused: false, // Track music state

      setJavaPath: (path) => set({ javaPath: path }),
      setRamAllocation: (ram) => set({ ramAllocation: ram }),
      setGameDirectory: (dir) => set({ gameDirectory: dir }),
      setServerAddress: (address) => set({ serverAddress: address }),
      setMinecraftVersion: (version) => set({ minecraftVersion: version }),
      setFabricEnabled: (enabled) => set({ fabricEnabled: enabled }),
      setFabricVersion: (version) => set({ fabricVersion: version }),
      setAutoUpdate: (enabled) => set({ autoUpdate: enabled }),
      setPreferStableFabric: (enabled) => set({ preferStableFabric: enabled }),
      setIsMinecraftInstalled: (installed) => set({ isMinecraftInstalled: installed }),
      setTheme: (theme) => set({ theme }),
      setManifestUrl: (url) => set({ manifestUrl: url }),
      setKeepLauncherOpen: (keep) => set({ keepLauncherOpen: keep }),
      setMusicWasPaused: (paused) => set({ musicWasPaused: paused }),

      // Initialize game directory with OS-specific default
      initializeGameDirectory: async () => {
        const state = get();

        // Only fetch default if:
        // 1. We haven't fetched it before, AND
        // 2. gameDirectory is empty or still set to the old default
        if (!state._defaultGameDirectoryFetched &&
            (!state.gameDirectory || state.gameDirectory === './game')) {
          try {
            const defaultDir = await invoke<string>('cmd_get_default_game_directory');
            console.log('[Settings] Using OS-specific game directory:', defaultDir);
            set({
              gameDirectory: defaultDir,
              _defaultGameDirectoryFetched: true
            });
          } catch (error) {
            console.error('[Settings] Failed to get default game directory:', error);
            // Fallback to platform-specific default if Tauri command fails
            try {
              const currentPlatform = platform();
              const home = await homeDir();
              
              let fallback: string;
              if (currentPlatform === 'windows') {
                fallback = 'C:\\Users\\Public\\wowid3-launcher\\game';
              } else if (currentPlatform === 'macos') {
                fallback = `${home}/Library/Application Support/wowid3-launcher/game`;
              } else {
                // Linux and other Unix-like systems
                fallback = `${home}/.local/share/wowid3-launcher/game`;
              }
              
              console.log('[Settings] Using platform-specific fallback:', fallback);
              set({
                gameDirectory: fallback,
                _defaultGameDirectoryFetched: true
              });
            } catch (fallbackError) {
              console.error('[Settings] Failed to determine platform fallback:', fallbackError);
              // Last resort: use a relative path
              set({
                gameDirectory: './game',
                _defaultGameDirectoryFetched: true
              });
            }
          }
        }
      },
    }),
    {
      name: 'wowid3-settings', // localStorage key
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Migration logic for updating old URLs
        if (version === 0) {
          // Fix old manifest URL
          if (persistedState.manifestUrl === 'https://your-server.com/wowid3/manifest.json') {
            persistedState.manifestUrl = 'https://wowid-launcher.frostdev.io/api/manifest/latest';
          }
          // Fix old server address
          if (persistedState.serverAddress === 'your-server.com:25565') {
            persistedState.serverAddress = 'mc.frostdev.io:25565';
          }
        }
        return persistedState;
      },
    }
  )
);
