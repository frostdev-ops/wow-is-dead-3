import { vi } from 'vitest';

export const mockTauriCommand = (_command: string, returnValue: any = {}) => {
  return vi.fn().mockResolvedValue(returnValue);
};

export const mockTauriListen = (_eventName: string, _handler?: (event: any) => void) => {
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

