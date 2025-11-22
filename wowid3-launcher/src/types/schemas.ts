/**
 * Zod Schemas
 *
 * Runtime validation schemas for external data from Tauri commands and APIs.
 */

import { z } from 'zod';

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SHA256 validation regex
 */
const SHA256_REGEX = /^[a-f0-9]{64}$/i;

/**
 * Minecraft Profile Schema
 */
export const MinecraftProfileSchema = z.object({
  uuid: z.string().min(1), // Relaxed - backend provides valid UUIDs
  username: z.string().min(1).max(16),
  session_id: z.string().min(1),
  access_token: z.string().min(1).optional(), // Legacy support
  skin_url: z.string().url().optional(),
  refresh_token: z.string().optional(),
  expires_at: z.string().optional(), // Relaxed datetime validation
});

export type MinecraftProfile = z.infer<typeof MinecraftProfileSchema>;

/**
 * Modpack File Schema
 */
export const ModpackFileSchema = z.object({
  path: z.string().min(1),
  url: z.string().url(),
  sha256: z.string().regex(SHA256_REGEX, 'Invalid SHA256 hash'),
  size: z.number().int().min(0), // Size 0 is valid for empty files
});

export type ModpackFile = z.infer<typeof ModpackFileSchema>;

/**
 * Manifest Schema
 */
export const ManifestSchema = z.object({
  version: z.string().min(1),
  minecraft_version: z.string().min(1),
  fabric_loader: z.string().min(1),
  files: z.array(ModpackFileSchema),
  changelog: z.string(),
  ignore_patterns: z.array(z.string()).default([]),
});

export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Player Info Schema
 */
export const PlayerInfoSchema = z.object({
  name: z.string().min(1),
  uuid: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional(),
  id: z.string().optional(),
}).transform((data) => ({
  ...data,
  id: data.id || data.uuid || data.name, // Ensure id is always present
}));

export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;

/**
 * Server Status Schema
 */
export const ServerStatusSchema = z.object({
  online: z.boolean(),
  player_count: z.number().int().min(0).optional(),
  max_players: z.number().int().min(0).optional(),
  version: z.string().optional(),
  motd: z.string().optional(),
  players: z.array(PlayerInfoSchema).default([]),
});

export type ServerStatus = z.infer<typeof ServerStatusSchema>;

/**
 * Player Extended Schema (for tracker)
 */
export const PlayerExtSchema = z.object({
  name: z.string().min(1),
  uuid: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  position: z.tuple([z.number(), z.number(), z.number()]).optional(),
  dimension: z.string().optional(),
  biome: z.string().optional(),
});

export type PlayerExt = z.infer<typeof PlayerExtSchema>;

/**
 * Chat Message Schema
 */
export const ChatMessageSchema = z.object({
  sender: z.string().min(1),
  content: z.string(),
  timestamp: z.number().int().positive(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Tracker State Schema
 */
export const TrackerStateSchema = z.object({
  online_players: z.array(PlayerExtSchema),
  recent_chat: z.array(ChatMessageSchema),
  tps: z.number().optional(),
  mspt: z.number().optional(),
  last_updated: z.number().int().positive(),
});

export type TrackerState = z.infer<typeof TrackerStateSchema>;

/**
 * Version Info Schema
 */
export const VersionInfoSchema = z.object({
  id: z.string().min(1),
  version_type: z.string().optional(), // Some versions may not have this
  url: z.string().url(),
  time: z.string().optional(),
  release_time: z.string().optional(),
});

export type VersionInfo = z.infer<typeof VersionInfoSchema>;

/**
 * Fabric Loader Schema
 */
export const FabricLoaderSchema = z.object({
  separator: z.string().optional(),
  build: z.number().int().min(0), // Build 0 is valid
  maven: z.string().min(1),
  version: z.string().min(1),
  stable: z.boolean(),
});

export type FabricLoader = z.infer<typeof FabricLoaderSchema>;

/**
 * Install Progress Schema
 */
export const InstallProgressSchema = z.object({
  step: z.enum(['version_meta', 'fabric', 'client', 'libraries', 'assets', 'complete']),
  current: z.number().int().min(0),
  total: z.number().int().min(0),
  current_bytes: z.number().int().min(0),
  total_bytes: z.number().int().min(0),
  message: z.string(),
});

export type InstallProgress = z.infer<typeof InstallProgressSchema>;

/**
 * Device Code Info Schema
 */
export const DeviceCodeInfoSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().url(),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive(),
});

export type DeviceCodeInfo = z.infer<typeof DeviceCodeInfoSchema>;

/**
 * Launcher Update Info Schema
 */
export const LauncherUpdateInfoSchema = z.object({
  available: z.boolean(),
  version: z.string().min(1),
  changelog: z.string(),
  mandatory: z.boolean(),
  download_url: z.string().url(),
  sha256: z.string().regex(SHA256_REGEX, 'Invalid SHA256 hash'),
});

export type LauncherUpdateInfo = z.infer<typeof LauncherUpdateInfoSchema>;

/**
 * BlueMap Status Schema
 */
export const BlueMapStatusSchema = z.object({
  available: z.boolean(),
  url: z.string().url(),
  error: z.string().nullable(),
});

export type BlueMapStatus = z.infer<typeof BlueMapStatusSchema>;

/**
 * Player Stats Schema
 */
export const PlayerStatsSchema = z.object({
  uuid: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  username: z.string().min(1),
  playtime_minutes: z.number().int().min(0),
  blocks_broken: z.number().int().min(0),
  blocks_placed: z.number().int().min(0),
  mobs_killed: z.number().int().min(0),
  deaths: z.number().int().min(0),
  distance_traveled_km: z.number().min(0),
  last_seen: z.number().int().positive(),
  first_seen: z.number().int().positive(),
});

export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

/**
 * Safe parsing utilities
 */

/**
 * Safe parse function that returns a result
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Parse and throw on error
 */
export function parseOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Type guards using Zod schemas
 */

export function isValidMinecraftProfile(data: unknown): data is MinecraftProfile {
  return MinecraftProfileSchema.safeParse(data).success;
}

export function isValidManifest(data: unknown): data is Manifest {
  return ManifestSchema.safeParse(data).success;
}

export function isValidServerStatus(data: unknown): data is ServerStatus {
  return ServerStatusSchema.safeParse(data).success;
}

export function isValidTrackerState(data: unknown): data is TrackerState {
  return TrackerStateSchema.safeParse(data).success;
}

export function isValidPlayerStats(data: unknown): data is PlayerStats {
  return PlayerStatsSchema.safeParse(data).success;
}

/**
 * Assertion functions using Zod schemas
 */

export function assertMinecraftProfile(data: unknown): asserts data is MinecraftProfile {
  MinecraftProfileSchema.parse(data);
}

export function assertManifest(data: unknown): asserts data is Manifest {
  ManifestSchema.parse(data);
}

export function assertServerStatus(data: unknown): asserts data is ServerStatus {
  ServerStatusSchema.parse(data);
}

export function assertTrackerState(data: unknown): asserts data is TrackerState {
  TrackerStateSchema.parse(data);
}

export function assertPlayerStats(data: unknown): asserts data is PlayerStats {
  PlayerStatsSchema.parse(data);
}
