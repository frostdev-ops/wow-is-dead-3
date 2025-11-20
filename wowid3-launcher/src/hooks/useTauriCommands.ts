import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import type { MinecraftProfile, Manifest, ServerStatus } from '../stores';
import { deduplicator } from '../utils/deduplication';
import {
  VersionInfo,
  FabricLoader,
  InstallConfig,
  LaunchConfig
} from '../types/minecraft';
import {
  MinecraftProfileSchema,
  ManifestSchema,
  ServerStatusSchema,
  TrackerStateSchema,
  DeviceCodeInfoSchema,
  VersionInfoSchema,
  FabricLoaderSchema,
} from '../types/schemas';

// Re-export LaunchConfig for backward compatibility
export type { LaunchConfig };

export interface DeviceCodeInfo {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface LauncherUpdateInfo {
    available: boolean;
    version: string;
    changelog: string;
    mandatory: boolean;
    download_url: string;
    sha256: string;
}

export interface AvatarData {
    data: string;  // Base64 encoded image data
    content_type: string;
}

// Authentication commands with Zod validation
export const authenticateMinecraft = async (): Promise<MinecraftProfile> => {
  try {
    const result = await invoke('cmd_authenticate');
    return MinecraftProfileSchema.parse(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`Invalid authentication response: ${err.message}`);
    }
    throw err;
  }
};

export const authenticateFromOfficialLauncher = async (): Promise<MinecraftProfile> => {
  try {
    const result = await invoke('cmd_authenticate_official_launcher');
    return MinecraftProfileSchema.parse(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`Invalid authentication response: ${err.message}`);
    }
    throw err;
  }
};

export const getCurrentUser = async (): Promise<MinecraftProfile | null> => {
  try {
    const result = await invoke('cmd_get_current_user');
    if (result === null) return null;
    return MinecraftProfileSchema.parse(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`Invalid user profile: ${err.message}`);
    }
    throw err;
  }
};

export const logout = async (): Promise<void> => {
  return await invoke<void>('cmd_logout');
};

export const refreshToken = async (): Promise<MinecraftProfile | null> => {
  try {
    const result = await invoke('cmd_refresh_token');
    if (result === null) return null;
    return MinecraftProfileSchema.parse(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`Invalid token response: ${err.message}`);
    }
    throw err;
  }
};

export const getDeviceCode = async (): Promise<DeviceCodeInfo> => {
  const result = await invoke('cmd_get_device_code');
  return DeviceCodeInfoSchema.parse(result);
};

export const completeDeviceCodeAuth = async (deviceCode: string, interval: number): Promise<MinecraftProfile> => {
  const result = await invoke('cmd_complete_device_code_auth', { deviceCode, interval });
  return MinecraftProfileSchema.parse(result);
};

export const fetchAvatar = async (username: string): Promise<AvatarData> => {
  return await invoke<AvatarData>('cmd_fetch_avatar', { username });
};

// Minecraft launch commands
export const launchGame = async (config: LaunchConfig): Promise<string> => {
  return await invoke<string>('cmd_launch_game', { config });
};

// Server status commands
export const pingServer = async (address: string): Promise<ServerStatus> => {
  const result = await deduplicator.execute(`pingServer:${address}`, () =>
    invoke('cmd_ping_server', { address })
  );
  return ServerStatusSchema.parse(result);
};

export const resolvePlayerName = async (uuid: string): Promise<string> => {
  return await invoke<string>('cmd_resolve_player_name', { uuid });
};

export const getDetailedServerStatus = async (baseUrl: string): Promise<any> => {
  const result = await invoke('cmd_get_detailed_server_status', { baseUrl });
  return TrackerStateSchema.parse(result);
};

// Modpack update commands
export const checkForUpdates = async (manifestUrl: string): Promise<Manifest> => {
  const result = await deduplicator.execute(`checkForUpdates:${manifestUrl}`, () =>
    invoke('cmd_check_updates', { manifestUrl })
  );
  return ManifestSchema.parse(result);
};

export const getInstalledVersion = async (gameDir: string): Promise<string | null> => {
  return await invoke<string | null>('cmd_get_installed_version', { gameDir });
};

export const installModpack = async (
  manifest: Manifest,
  gameDir: string
): Promise<string> => {
  return await invoke<string>('cmd_install_modpack', { manifest, gameDir });
};

export const verifyAndRepairModpack = async (
  manifest: Manifest,
  gameDir: string
): Promise<string> => {
  return await invoke<string>('cmd_verify_and_repair_modpack', { manifest, gameDir });
};

export const hasManifestChanged = async (
  manifest: Manifest,
  gameDir: string
): Promise<boolean> => {
  return await invoke<boolean>('cmd_has_manifest_changed', { manifest, gameDir });
};

// Discord Rich Presence commands
export const discordConnect = async (): Promise<void> => {
  return await invoke<void>('cmd_discord_connect');
};

export const discordSetPresence = async (details: string, state: string, largeImage?: string): Promise<void> => {
  return await invoke<void>('cmd_discord_set_presence', { details, state, large_image: largeImage });
};

export const discordUpdatePresence = async (
  details: string,
  state: string,
  largeImage?: string,
  smallImage?: string,
  partySize?: number,
  partyMax?: number,
  startTime?: number
): Promise<void> => {
  return await invoke<void>('cmd_discord_update_presence', {
    details,
    state,
    large_image: largeImage,
    small_image: smallImage,
    party_size: partySize,
    party_max: partyMax,
    start_time: startTime
  });
};

export const discordClearPresence = async (): Promise<void> => {
  return await invoke<void>('cmd_discord_clear_presence');
};

export const discordDisconnect = async (): Promise<void> => {
  return await invoke<void>('cmd_discord_disconnect');
};

export const discordIsConnected = async (): Promise<boolean> => {
  return await invoke<boolean>('cmd_discord_is_connected');
};

// ============ Minecraft Installation System Commands ============

// Version Management
export const listMinecraftVersions = async (versionType?: 'release' | 'snapshot'): Promise<VersionInfo[]> => {
  const result = await invoke('cmd_list_minecraft_versions', { versionType });
  return z.array(VersionInfoSchema).parse(result);
};

export const getLatestRelease = async (): Promise<string> => {
  return await invoke<string>('cmd_get_latest_release');
};

export const getLatestSnapshot = async (): Promise<string> => {
  return await invoke<string>('cmd_get_latest_snapshot');
};

// Fabric Loader Management
export const getFabricLoaders = async (gameVersion: string): Promise<FabricLoader[]> => {
  const result = await invoke('cmd_get_fabric_loaders', { gameVersion });
  return z.array(FabricLoaderSchema).parse(result);
};

export const getLatestFabricLoader = async (gameVersion: string): Promise<FabricLoader> => {
  const result = await invoke('cmd_get_latest_fabric_loader', { gameVersion });
  return FabricLoaderSchema.parse(result);
};

// Installation Commands
export const installMinecraft = async (config: InstallConfig): Promise<void> => {
  return await invoke<void>('cmd_install_minecraft', { config });
};

export const isVersionInstalled = async (gameDir: string, versionId: string): Promise<boolean> => {
  return await invoke<boolean>('cmd_is_version_installed', { gameDir, versionId });
};

// Game Launch (New Metadata System)
export const launchGameWithMetadata = async (config: LaunchConfig, versionId: string): Promise<string> => {
  return await invoke<string>('cmd_launch_game_with_metadata', { config, versionId });
};

export const isGameRunning = async (): Promise<boolean> => {
  return await invoke<boolean>('cmd_is_game_running');
};

// Audio commands
export const getCachedAudio = async (): Promise<string | null> => {
  return await invoke<string | null>('cmd_get_cached_audio');
};

export const downloadAndCacheAudio = async (url: string): Promise<string> => {
  return await invoke<string>('cmd_download_and_cache_audio', { url });
};

export const clearAudioCache = async (): Promise<void> => {
  return await invoke<void>('cmd_clear_audio_cache');
};

// Launcher update commands
export const checkLauncherUpdate = async (): Promise<LauncherUpdateInfo> => {
    return await invoke<LauncherUpdateInfo>('cmd_check_launcher_update');
};

export const installLauncherUpdate = async (url: string, sha256: string): Promise<void> => {
    return await invoke<void>('cmd_install_launcher_update', { url, sha256 });
};

// BlueMap commands
export interface BlueMapStatus {
  available: boolean;
  url: string;
  error: string | null;
}

export const checkBlueMapAvailable = async (): Promise<BlueMapStatus> => {
  return await invoke<BlueMapStatus>('cmd_check_bluemap_available');
};

export const openMapViewer = async (): Promise<void> => {
  return await invoke<void>('cmd_open_map_viewer');
};

export const closeMapViewer = async (): Promise<void> => {
  return await invoke<void>('cmd_close_map_viewer');
};

export const getBlueMapUrl = async (): Promise<string> => {
  return await invoke<string>('cmd_get_bluemap_url');
};
