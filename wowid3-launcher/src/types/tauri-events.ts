/**
 * Type definitions for Tauri event payloads
 * Provides type safety for event listeners and emitters
 */

/**
 * Download progress event payload
 */
export interface DownloadProgressPayload {
  current: number;
  total: number;
  percentage?: number;
  speed?: number;
  filename?: string;
}

/**
 * Installation progress event payload
 */
export interface InstallProgressPayload {
  step: string;
  current: number;
  total: number;
  percentage: number;
  message?: string;
}

/**
 * Verification progress event payload
 */
export interface VerificationProgressPayload {
  current: number;
  total: number;
  percentage: number;
  action: 'verifying' | 'repairing' | 'complete';
  corrupted?: number;
  missing?: number;
}

/**
 * Log line event payload
 */
export interface LogLinePayload {
  line: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  timestamp: string;
}

/**
 * Game state change event payload
 */
export interface GameStatePayload {
  state: 'stopped' | 'starting' | 'running' | 'crashed';
  exitCode?: number;
  error?: string;
}

/**
 * Modpack update available event payload
 */
export interface ModpackUpdatePayload {
  currentVersion: string;
  availableVersion: string;
  changelog?: string;
  manifestHash: string;
}

/**
 * Launcher update available event payload
 */
export interface LauncherUpdatePayload {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
  mandatory?: boolean;
}

/**
 * Authentication status event payload
 */
export interface AuthStatusPayload {
  authenticated: boolean;
  username?: string;
  uuid?: string;
  expiresAt?: number;
}

/**
 * Discord presence update event payload
 */
export interface DiscordPresencePayload {
  state: string;
  details: string;
  largeImageKey?: string;
  largeImageText?: string;
  startTimestamp?: number;
  partySize?: number;
  partyMax?: number;
}

/**
 * File verification result payload
 */
export interface FileVerificationPayload {
  path: string;
  status: 'ok' | 'missing' | 'corrupted';
  expectedHash?: string;
  actualHash?: string;
}

/**
 * Error event payload
 */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable?: boolean;
}

/**
 * Toast notification payload
 */
export interface ToastPayload {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

/**
 * Map of event names to their payload types
 */
export interface TauriEventMap {
  'download-progress': DownloadProgressPayload;
  'install-progress': InstallProgressPayload;
  'verification-progress': VerificationProgressPayload;
  'log-line': LogLinePayload;
  'game-state': GameStatePayload;
  'modpack-update': ModpackUpdatePayload;
  'launcher-update': LauncherUpdatePayload;
  'auth-status': AuthStatusPayload;
  'discord-presence': DiscordPresencePayload;
  'file-verification': FileVerificationPayload;
  'error': ErrorPayload;
  'toast': ToastPayload;
}

/**
 * Type-safe event names
 */
export type TauriEventName = keyof TauriEventMap;

/**
 * Get the payload type for a specific event name
 */
export type TauriEventPayload<T extends TauriEventName> = TauriEventMap[T];

/**
 * Type-safe event listener
 */
export interface TauriEventListener<T extends TauriEventName> {
  (event: { payload: TauriEventPayload<T> }): void;
}

/**
 * Example usage:
 *
 * ```typescript
 * import { listen } from '@tauri-apps/api/event';
 * import { TauriEventListener } from './types/tauri-events';
 *
 * // Type-safe event listener
 * const handleDownloadProgress: TauriEventListener<'download-progress'> = (event) => {
 *   const { current, total, percentage } = event.payload;
 *   console.log(`Download: ${percentage}%`);
 * };
 *
 * // Subscribe to events
 * listen('download-progress', handleDownloadProgress);
 *
 * // Emit events
 * emit('toast', {
 *   message: 'Download complete',
 *   type: 'success',
 *   duration: 3000,
 * });
 * ```
 */
