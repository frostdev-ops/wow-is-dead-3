import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri
vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
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
