import { invoke } from '@tauri-apps/api/core';
import { MinecraftProfile, Manifest, ServerStatus } from '../stores';
import { deduplicator } from '../utils/deduplication';
import {
  VersionInfo,
  FabricLoader,
  InstallConfig,
  LaunchConfig
} from '../types/minecraft';

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

// Authentication commands
export const authenticateMinecraft = async (): Promise<MinecraftProfile> => {
  return await invoke<MinecraftProfile>('cmd_authenticate');
};

export const authenticateFromOfficialLauncher = async (): Promise<MinecraftProfile> => {
  return await invoke<MinecraftProfile>('cmd_authenticate_official_launcher');
};

export const getCurrentUser = async (): Promise<MinecraftProfile | null> => {
  return await invoke<MinecraftProfile | null>('cmd_get_current_user');
};

export const logout = async (): Promise<void> => {
  return await invoke<void>('cmd_logout');
};

export const refreshToken = async (): Promise<MinecraftProfile | null> => {
  return await invoke<MinecraftProfile | null>('cmd_refresh_token');
};

export const getDeviceCode = async (): Promise<DeviceCodeInfo> => {
  return await invoke<DeviceCodeInfo>('cmd_get_device_code');
};

export const completeDeviceCodeAuth = async (deviceCode: string, interval: number): Promise<MinecraftProfile> => {
  return await invoke<MinecraftProfile>('cmd_complete_device_code_auth', { deviceCode, interval });
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
  return await deduplicator.execute(`pingServer:${address}`, () => 
    invoke<ServerStatus>('cmd_ping_server', { address })
  );
};

export const resolvePlayerName = async (uuid: string): Promise<string> => {
  return await invoke<string>('cmd_resolve_player_name', { uuid });
};

export const getDetailedServerStatus = async (baseUrl: string): Promise<any> => {
  return await invoke<any>('cmd_get_detailed_server_status', { baseUrl });
};

// Modpack update commands
export const checkForUpdates = async (manifestUrl: string): Promise<Manifest> => {
  return await deduplicator.execute(`checkForUpdates:${manifestUrl}`, () => 
    invoke<Manifest>('cmd_check_updates', { manifestUrl })
  );
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
  return await invoke<VersionInfo[]>('cmd_list_minecraft_versions', { versionType });
};

export const getLatestRelease = async (): Promise<string> => {
  return await invoke<string>('cmd_get_latest_release');
};

export const getLatestSnapshot = async (): Promise<string> => {
  return await invoke<string>('cmd_get_latest_snapshot');
};

// Fabric Loader Management
export const getFabricLoaders = async (gameVersion: string): Promise<FabricLoader[]> => {
  return await invoke<FabricLoader[]>('cmd_get_fabric_loaders', { gameVersion });
};

export const getLatestFabricLoader = async (gameVersion: string): Promise<FabricLoader> => {
  return await invoke<FabricLoader>('cmd_get_latest_fabric_loader', { gameVersion });
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
