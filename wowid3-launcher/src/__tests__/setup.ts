import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock localStorage FIRST, before any imports that might use Zustand persist
const localStorageData: Record<string, string> = {};

class LocalStorageMock implements Storage {
  get length() { return Object.keys(localStorageData).length; }
  
  getItem(key: string): string | null {
    return localStorageData[key] || null;
  }
  
  setItem(key: string, value: string): void {
    localStorageData[key] = value;
  }
  
  removeItem(key: string): void {
    delete localStorageData[key];
  }
  
  clear(): void {
    Object.keys(localStorageData).forEach(k => delete localStorageData[k]);
  }
  
  key(index: number): string | null {
    return Object.keys(localStorageData)[index] || null;
  }
}

const mockInstance = new LocalStorageMock();
global.localStorage = mockInstance;

// Verify localStorage is properly mocked
if (typeof window !== 'undefined') {
  (window as any).localStorage = mockInstance;
}

// Now import stores after localStorage is mocked
import { useModpackStore } from '../stores/modpackStore';
import { useAuthStore } from '../stores/authStore';
import { useServerStore } from '../stores/serverStore';
import { useAudioStore } from '../stores/audioStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';

// Clear storage before each test
export const clearMockStorage = () => {
  Object.keys(localStorageData).forEach(k => delete localStorageData[k]);
};

// Mock @tauri-apps/api/core - this will use the __mocks__ directory
vi.mock('@tauri-apps/api/core');

// Mock Tauri event system
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_event, _handler) => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    show: vi.fn(),
    hide: vi.fn(),
    minimize: vi.fn(),
    close: vi.fn(),
  })),
}));

// Global test utilities
declare global {
  interface Window {
    __resetAllStores: () => void;
    __setMockInvokeResponses: (responses: Record<string, any>) => void;
  }
}

// Helper to reset all Zustand stores to initial state
export const resetAllStores = () => {
  // Clear localStorage first
  clearMockStorage();
  
  // Reset stores
  useModpackStore.getState().reset?.();
  useAuthStore.getState().logout?.();
  useServerStore.setState({
    status: { online: false, players: [] },
    isPolling: false,
    lastUpdated: null,
    error: null,
  });
  useAudioStore.getState().reset?.();
  useSettingsStore.setState((state) => ({
    ...state,
    javaPath: null,
    ramAllocation: 16384,
    gameDirectory: '/home/test/.minecraft',
    serverAddress: 'mc.frostdev.io:25565',
    _defaultGameDirectoryFetched: true,
    minecraftVersion: '1.20.1',
    fabricEnabled: true,
    fabricVersion: '0.17.3',
    autoUpdate: false,
    preferStableFabric: true,
    isMinecraftInstalled: false,
    theme: 'christmas' as const,
    manifestUrl: 'https://wowid-launcher.frostdev.io/api/manifest/latest',
    keepLauncherOpen: false,
    musicWasPaused: false,
  }));
  useUIStore.setState({
    showLogViewer: false,
  });
};

// Make utilities available globally for tests
if (typeof window !== 'undefined') {
  window.__resetAllStores = resetAllStores;
}

// Clear storage before each test automatically
beforeEach(() => {
  clearMockStorage();
});
