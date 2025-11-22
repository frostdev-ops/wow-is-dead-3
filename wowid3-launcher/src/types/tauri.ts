/**
 * Tauri Interop Types
 *
 * Types for Rust <-> TypeScript interop via Tauri commands.
 */

import { UUID, Bytes, ISO8601 } from './utils';

/**
 * Launch Config for Minecraft
 */
export interface LaunchConfig {
  ram_mb: number;
  java_path?: string;
  game_dir: string;
  username: string;
  uuid: UUID;
  access_token: string;
}

/**
 * Install Config for Minecraft
 */
export interface InstallConfig {
  game_version: string;
  fabric_version?: string;
  game_dir: string;
}

/**
 * Download Progress Event Payload
 */
export interface DownloadProgressEvent {
  current: number;
  total: number;
  filename: string;
  current_bytes: Bytes;
  total_bytes: Bytes;
}

/**
 * Minecraft Profile from Rust
 */
export interface MinecraftProfileRaw {
  uuid: string;
  username: string;
  access_token: string;
  skin_url?: string;
  refresh_token?: string;
  expires_at?: ISO8601;
}

/**
 * Manifest from Rust
 */
export interface ManifestRaw {
  version: string;
  minecraft_version: string;
  fabric_loader: string;
  files: Array<{
    path: string;
    url: string;
    sha256: string;
    size: number;
  }>;
  changelog: string;
  ignore_patterns?: string[];
}

/**
 * Server Status from Rust
 */
export interface ServerStatusRaw {
  online: boolean;
  player_count?: number;
  max_players?: number;
  version?: string;
  motd?: string;
  players?: Array<{
    name: string;
    uuid?: string;
    id?: string;
  }>;
}

/**
 * Tracker State from Rust
 */
export interface TrackerStateRaw {
  online_players: Array<{
    name: string;
    uuid: string;
    position?: [number, number, number];
    dimension?: string;
    biome?: string;
  }>;
  recent_chat: Array<{
    sender: string;
    content: string;
    timestamp: number;
  }>;
  tps?: number;
  mspt?: number;
  last_updated: number;
}

/**
 * Install Progress Event from Rust
 */
export interface InstallProgressEvent {
  step: 'version_meta' | 'fabric' | 'client' | 'libraries' | 'assets' | 'complete';
  current: number;
  total: number;
  current_bytes: Bytes;
  total_bytes: Bytes;
  message: string;
}

/**
 * Device Code Info from Rust
 */
export interface DeviceCodeInfoRaw {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/**
 * Launcher Update Info from Rust
 */
export interface LauncherUpdateInfoRaw {
  available: boolean;
  version: string;
  changelog: string;
  mandatory: boolean;
  download_url: string;
  sha256: string;
}

/**
 * BlueMap Status from Rust
 */
export interface BlueMapStatusRaw {
  available: boolean;
  url: string;
  error: string | null;
}

/**
 * Player Stats from Rust
 */
export interface PlayerStatsRaw {
  uuid: string;
  username: string;
  playtime_minutes: number;
  blocks_broken: number;
  blocks_placed: number;
  mobs_killed: number;
  deaths: number;
  distance_traveled_km: number;
  last_seen: number;
  first_seen: number;
}
