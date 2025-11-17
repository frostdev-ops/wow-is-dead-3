import { invoke } from '@tauri-apps/api/core';
import { MinecraftProfile, Manifest, ServerStatus } from '../stores';

export interface LaunchConfig {
  ram_mb: number;
  java_path?: string;
  game_dir: string;
  username: string;
  uuid: string;
  access_token: string;
}

export interface DeviceCodeInfo {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
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

// Minecraft launch commands
export const launchGame = async (config: LaunchConfig): Promise<string> => {
  return await invoke<string>('cmd_launch_game', { config });
};

// Server status commands
export const pingServer = async (address: string): Promise<ServerStatus> => {
  return await invoke<ServerStatus>('cmd_ping_server', { address });
};

// Modpack update commands
export const checkForUpdates = async (manifestUrl: string): Promise<Manifest> => {
  return await invoke<Manifest>('cmd_check_updates', { manifestUrl });
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

// Discord Rich Presence commands
export const discordConnect = async (): Promise<void> => {
  return await invoke<void>('cmd_discord_connect');
};

export const discordSetPresence = async (details: string, state: string, largeImage?: string): Promise<void> => {
  return await invoke<void>('cmd_discord_set_presence', { details, state, large_image: largeImage });
};

export const discordUpdatePresence = async (details: string, state: string): Promise<void> => {
  return await invoke<void>('cmd_discord_update_presence', { details, state });
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
