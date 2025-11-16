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

// Authentication commands
export const authenticateMinecraft = async (): Promise<MinecraftProfile> => {
  return await invoke<MinecraftProfile>('cmd_authenticate');
};

export const getCurrentUser = async (): Promise<MinecraftProfile | null> => {
  return await invoke<MinecraftProfile | null>('cmd_get_current_user');
};

export const logout = async (): Promise<void> => {
  return await invoke<void>('cmd_logout');
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
