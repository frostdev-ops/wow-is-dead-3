import { vi } from 'vitest';

// Mock Tauri invoke function
export const invoke = vi.fn();

// Reset function for tests
export const __resetMocks = () => {
  invoke.mockReset();
};

// Helper to set mock responses
export const __setMockInvokeResponse = (command: string, response: any, shouldReject = false) => {
  invoke.mockImplementation((cmd: string, args?: any) => {
    if (cmd === command) {
      if (shouldReject) {
        return Promise.reject(response);
      }
      return Promise.resolve(response);
    }
    return Promise.reject(new Error(`Unhandled command: ${cmd}`));
  });
};

// Helper for multiple command responses
export const __setMockInvokeResponses = (
  responses: Record<string, { response: any; reject?: boolean }>
) => {
  invoke.mockImplementation((cmd: string, args?: any) => {
    const mock = responses[cmd];
    if (mock) {
      if (mock.reject) {
        return Promise.reject(mock.response);
      }
      return Promise.resolve(mock.response);
    }
    return Promise.reject(new Error(`Unhandled command: ${cmd}`));
  });
};

// Default implementation - rejects all unknown commands
invoke.mockImplementation((cmd: string) => {
  console.warn(`Unhandled Tauri command in test: ${cmd}`);
  return Promise.reject(new Error(`Unhandled command: ${cmd}`));
});
