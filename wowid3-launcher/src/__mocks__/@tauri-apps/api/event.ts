import { vi } from 'vitest';

type EventCallback<T> = (event: { payload: T }) => void;
type UnlistenFn = () => void;

// Store event listeners
const eventListeners = new Map<string, Set<EventCallback<any>>>();

// Mock listen function
export const listen = vi.fn(<T = any>(
  event: string,
  handler: EventCallback<T>
): Promise<UnlistenFn> => {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }

  const listeners = eventListeners.get(event)!;
  listeners.add(handler);

  // Return unlisten function
  const unlisten = () => {
    listeners.delete(handler);
  };

  return Promise.resolve(unlisten);
});

// Mock emit function
export const emit = vi.fn(<T = any>(event: string, payload: T): Promise<void> => {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach((handler) => {
      handler({ payload });
    });
  }
  return Promise.resolve();
});

// Mock once function
export const once = vi.fn(<T = any>(
  event: string,
  handler: EventCallback<T>
): Promise<UnlistenFn> => {
  const wrappedHandler = ((evt: { payload: unknown }) => {
    handler(evt as { payload: T });
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(wrappedHandler);
    }
  }) as EventCallback<any>;

  return listen(event, wrappedHandler);
});

// Helper to emit events in tests
export const __emitEvent = <T = any>(event: string, payload: T) => {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach((handler) => {
      handler({ payload });
    });
  }
};

// Helper to clear all event listeners
export const __clearEventListeners = () => {
  eventListeners.clear();
};

// Helper to get listener count for an event
export const __getListenerCount = (event: string): number => {
  return eventListeners.get(event)?.size || 0;
};
