import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Java settings
  javaPath: string | null;
  ramAllocation: number; // in MB

  // Game settings
  gameDirectory: string;
  serverAddress: string;

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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      javaPath: null, // Will use bundled Java
      ramAllocation: 12512, // 4GB default
      gameDirectory: './game',
      serverAddress: 'mc.frostdev.io:25565',
      minecraftVersion: '1.20.1', // Default from modpack requirements
      fabricEnabled: true, // Always enabled for WOWID3 modpack
      fabricVersion: '0.17.3', // Default from modpack requirements
      autoUpdate: false,
      preferStableFabric: true,
      isMinecraftInstalled: false, // Will be checked on startup
      theme: 'christmas',
      manifestUrl: 'https://wowid-launcher.frostdev.io/api/manifest/latest',

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
