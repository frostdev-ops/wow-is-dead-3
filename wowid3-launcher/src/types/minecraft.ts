// Minecraft Version Management Types

export interface VersionInfo {
  id: string;              // "1.20.1"
  version_type: string;    // "release" or "snapshot"
  url: string;
  time: string;
  release_time: string;
}

export interface FabricLoader {
  separator?: string;  // Optional: "."
  build: number;       // Build number
  maven: string;       // Maven coordinates
  version: string;     // "0.18.0"
  stable: boolean;     // Is this a stable release?
}

export interface InstallConfig {
  game_version: string;      // "1.20.1"
  fabric_version?: string;   // Optional: "0.18.0" (omit for vanilla)
  game_dir: string;          // Absolute path to game directory
}

export interface LaunchConfig {
  ram_mb: number;           // RAM allocation in MB (e.g., 4096)
  java_path?: string;       // Optional: custom Java path
  game_dir: string;         // Game directory path
  username: string;         // Minecraft username
  uuid: string;             // Player UUID
  access_token: string;     // Minecraft access token
}

export interface InstallProgress {
  step: string;      // "version_meta" | "fabric" | "client" | "libraries" | "assets" | "complete"
  current: number;   // Current progress
  total: number;     // Total items
  message: string;   // Human-readable message
}

export type InstallStep =
  | 'version_meta'
  | 'fabric'
  | 'client'
  | 'libraries'
  | 'assets'
  | 'complete';

export const INSTALL_STEP_LABELS: Record<InstallStep, string> = {
  version_meta: 'Fetching version metadata...',
  fabric: 'Installing Fabric loader...',
  client: 'Downloading Minecraft client...',
  libraries: 'Downloading libraries...',
  assets: 'Downloading assets...',
  complete: 'Installation complete!',
};
