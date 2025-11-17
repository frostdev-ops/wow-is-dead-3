import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Java settings
  javaPath: string | null;
  ramAllocation: number; // in MB

  // Game settings
  gameDirectory: string;
  serverAddress: string;

  // Launcher settings
  theme: 'christmas' | 'dark' | 'light';
  manifestUrl: string;

  // Actions
  setJavaPath: (path: string | null) => void;
  setRamAllocation: (ram: number) => void;
  setGameDirectory: (dir: string) => void;
  setServerAddress: (address: string) => void;
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
      theme: 'christmas',
      manifestUrl: 'https://wowid-launcher.frostdev.io/api/manifest/latest',

      setJavaPath: (path) => set({ javaPath: path }),
      setRamAllocation: (ram) => set({ ramAllocation: ram }),
      setGameDirectory: (dir) => set({ gameDirectory: dir }),
      setServerAddress: (address) => set({ serverAddress: address }),
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
