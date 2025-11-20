import { vi } from 'vitest';

// Store for mock responses
let mockResponses: Record<string, { response: any; reject?: boolean }> = {};

// Mock Tauri invoke function
export const invoke = vi.fn((cmd: string, _args?: any) => {
  const mock = mockResponses[cmd];
  if (mock) {
    if (mock.reject) {
      return Promise.reject(mock.response);
    }
    return Promise.resolve(mock.response);
  }
  console.warn(`Unhandled Tauri command in test: ${cmd}`);
  return Promise.reject(new Error(`Unhandled command: ${cmd}`));
});

// Reset function for tests
export const __resetMocks = () => {
  invoke.mockClear();
  mockResponses = {};
};

// Helper to set mock responses for a single command
export const __setMockInvokeResponse = (command: string, response: any, shouldReject = false) => {
  mockResponses[command] = { response, reject: shouldReject };
};

// Helper for multiple command responses
export const __setMockInvokeResponses = (
  responses: Record<string, { response: any; reject?: boolean }>
) => {
  mockResponses = { ...mockResponses, ...responses };
};
