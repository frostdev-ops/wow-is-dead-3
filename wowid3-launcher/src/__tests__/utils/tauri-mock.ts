import { vi } from 'vitest';

export const mockTauriCommand = (command: string, returnValue: any = {}) => {
  return vi.fn().mockResolvedValue(returnValue);
};

export const mockTauriListen = (eventName: string, handler?: (event: any) => void) => {
  return vi.fn().mockResolvedValue(() => {
    // Unlisten function
  });
};

export const setupTauriMocks = () => {
  const invoke = vi.fn();
  const listen = vi.fn();
  const emit = vi.fn();

  return { invoke, listen, emit };
};

