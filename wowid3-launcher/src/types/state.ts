/**
 * State Types
 *
 * Discriminated unions for state management in the WOWID3 launcher.
 */

import { LauncherError } from './errors';
import { Bytes, Milliseconds } from './utils';

/**
 * Modpack state - discriminated union for type-safe state management
 */
export type ModpackState =
  | { type: 'idle' }
  | { type: 'checking' }
  | {
      type: 'downloading';
      progress: {
        currentBytes: Bytes;
        totalBytes: Bytes;
        currentFile: number;
        totalFiles: number;
        currentFilePath: string;
      };
    }
  | { type: 'verifying'; silent: boolean }
  | { type: 'blocked'; reason: string }
  | { type: 'error'; error: LauncherError };

/**
 * Authentication state - discriminated union for OAuth flow
 */
export type AuthState =
  | { type: 'unauthenticated' }
  | { type: 'requesting-device-code' }
  | {
      type: 'awaiting-user-auth';
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      expiresIn: Milliseconds;
    }
  | { type: 'polling'; deviceCode: string; interval: Milliseconds }
  | {
      type: 'authenticated';
      uuid: string;
      username: string;
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
      skinUrl?: string;
    }
  | { type: 'error'; error: LauncherError };

/**
 * Installation stage - discriminated union for Minecraft installation
 */
export type InstallationStage =
  | { type: 'not-started' }
  | { type: 'checking-installed' }
  | { type: 'version-meta'; message: string }
  | {
      type: 'fabric';
      message: string;
      fabricVersion?: string;
    }
  | {
      type: 'client';
      message: string;
      progress: {
        currentBytes: Bytes;
        totalBytes: Bytes;
      };
    }
  | {
      type: 'libraries';
      message: string;
      progress: {
        current: number;
        total: number;
        currentBytes: Bytes;
        totalBytes: Bytes;
      };
    }
  | {
      type: 'assets';
      message: string;
      progress: {
        current: number;
        total: number;
        currentBytes: Bytes;
        totalBytes: Bytes;
      };
    }
  | { type: 'complete'; message: string; versionId: string }
  | { type: 'error'; error: LauncherError };

/**
 * Game state - discriminated union for game launch state
 */
export type GameState =
  | { type: 'not-running' }
  | { type: 'launching'; config: { username: string; versionId: string } }
  | { type: 'running'; pid: string; startTime: Milliseconds }
  | { type: 'error'; error: LauncherError };

/**
 * Server status state - discriminated union
 */
export type ServerStatusState =
  | { type: 'unknown' }
  | { type: 'checking' }
  | {
      type: 'online';
      playerCount: number;
      maxPlayers: number;
      motd: string;
      version: string;
    }
  | { type: 'offline'; reason?: string }
  | { type: 'error'; error: LauncherError };

/**
 * Download state - generic download state
 */
export type DownloadState =
  | { type: 'idle' }
  | { type: 'pending'; url: string }
  | {
      type: 'downloading';
      url: string;
      progress: {
        currentBytes: Bytes;
        totalBytes: Bytes;
        speed: Bytes; // bytes per second
      };
    }
  | { type: 'complete'; path: string }
  | { type: 'error'; error: LauncherError };

/**
 * Type guard for ModpackState
 */
export function isModpackState(state: unknown): state is ModpackState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'type' in state &&
    typeof state.type === 'string'
  );
}

/**
 * Type guard for AuthState
 */
export function isAuthState(state: unknown): state is AuthState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'type' in state &&
    typeof state.type === 'string'
  );
}

/**
 * Type guard for InstallationStage
 */
export function isInstallationStage(state: unknown): state is InstallationStage {
  return (
    typeof state === 'object' &&
    state !== null &&
    'type' in state &&
    typeof state.type === 'string'
  );
}

/**
 * Type guard for GameState
 */
export function isGameState(state: unknown): state is GameState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'type' in state &&
    typeof state.type === 'string'
  );
}

/**
 * Helper to create ModpackState
 */
export const ModpackStateFactory = {
  idle: (): ModpackState => ({ type: 'idle' }),
  checking: (): ModpackState => ({ type: 'checking' }),
  downloading: (
    currentBytes: Bytes,
    totalBytes: Bytes,
    currentFile: number,
    totalFiles: number,
    currentFilePath: string
  ): ModpackState => ({
    type: 'downloading',
    progress: { currentBytes, totalBytes, currentFile, totalFiles, currentFilePath },
  }),
  verifying: (silent: boolean): ModpackState => ({ type: 'verifying', silent }),
  blocked: (reason: string): ModpackState => ({ type: 'blocked', reason }),
  error: (error: LauncherError): ModpackState => ({ type: 'error', error }),
};

/**
 * Helper to create AuthState
 */
export const AuthStateFactory = {
  unauthenticated: (): AuthState => ({ type: 'unauthenticated' }),
  requestingDeviceCode: (): AuthState => ({ type: 'requesting-device-code' }),
  awaitingUserAuth: (
    deviceCode: string,
    userCode: string,
    verificationUri: string,
    expiresIn: Milliseconds
  ): AuthState => ({
    type: 'awaiting-user-auth',
    deviceCode,
    userCode,
    verificationUri,
    expiresIn,
  }),
  polling: (deviceCode: string, interval: Milliseconds): AuthState => ({
    type: 'polling',
    deviceCode,
    interval,
  }),
  authenticated: (
    uuid: string,
    username: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: string,
    skinUrl?: string
  ): AuthState => ({
    type: 'authenticated',
    uuid,
    username,
    accessToken,
    refreshToken,
    expiresAt,
    skinUrl,
  }),
  error: (error: LauncherError): AuthState => ({ type: 'error', error }),
};

/**
 * Helper to create InstallationStage
 */
export const InstallationStageFactory = {
  notStarted: (): InstallationStage => ({ type: 'not-started' }),
  checkingInstalled: (): InstallationStage => ({ type: 'checking-installed' }),
  versionMeta: (message: string): InstallationStage => ({ type: 'version-meta', message }),
  fabric: (message: string, fabricVersion?: string): InstallationStage => ({
    type: 'fabric',
    message,
    fabricVersion,
  }),
  client: (message: string, currentBytes: Bytes, totalBytes: Bytes): InstallationStage => ({
    type: 'client',
    message,
    progress: { currentBytes, totalBytes },
  }),
  libraries: (
    message: string,
    current: number,
    total: number,
    currentBytes: Bytes,
    totalBytes: Bytes
  ): InstallationStage => ({
    type: 'libraries',
    message,
    progress: { current, total, currentBytes, totalBytes },
  }),
  assets: (
    message: string,
    current: number,
    total: number,
    currentBytes: Bytes,
    totalBytes: Bytes
  ): InstallationStage => ({
    type: 'assets',
    message,
    progress: { current, total, currentBytes, totalBytes },
  }),
  complete: (message: string, versionId: string): InstallationStage => ({
    type: 'complete',
    message,
    versionId,
  }),
  error: (error: LauncherError): InstallationStage => ({ type: 'error', error }),
};
