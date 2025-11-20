/**
 * Type System Index
 *
 * Central export for all types in the WOWID3 launcher.
 */

// Utility types
export type {
  Brand,
  UUID,
  Milliseconds,
  Bytes,
  SHA256,
  ISO8601,
  Nullable,
  Optional,
  Result,
  FromPromise,
  DeepReadonly,
  PartialBy,
  RequiredBy,
  KeysOfType,
  NonEmptyArray,
  Prettify,
} from './utils';

export {
  isDefined,
  isNull,
  isNonEmptyString,
  isNonEmptyArray,
  assertDefined,
  assertNever,
  brand,
  unbrand,
} from './utils';

// Error types
export {
  LauncherErrorCode,
  ErrorSeverity,
  type LauncherError,
  createLauncherError,
  parseLauncherError,
  isLauncherError,
  assertLauncherError,
  formatLauncherError,
  getUserFriendlyErrorMessage,
} from './errors';

// State types
export type {
  ModpackState,
  AuthState,
  InstallationStage,
  GameState,
  ServerStatusState,
  DownloadState,
} from './state';

export {
  isModpackState,
  isAuthState,
  isInstallationStage,
  isGameState,
  ModpackStateFactory,
  AuthStateFactory,
  InstallationStageFactory,
} from './state';

// Zod schemas and validated types
export {
  MinecraftProfileSchema,
  ModpackFileSchema,
  ManifestSchema,
  PlayerInfoSchema,
  ServerStatusSchema,
  PlayerExtSchema,
  ChatMessageSchema,
  TrackerStateSchema,
  VersionInfoSchema,
  FabricLoaderSchema,
  InstallProgressSchema,
  DeviceCodeInfoSchema,
  LauncherUpdateInfoSchema,
  BlueMapStatusSchema,
  PlayerStatsSchema,
  safeParse,
  parseOrThrow,
  isValidMinecraftProfile,
  isValidManifest,
  isValidServerStatus,
  isValidTrackerState,
  isValidPlayerStats,
  assertMinecraftProfile,
  assertManifest,
  assertServerStatus,
  assertTrackerState,
  assertPlayerStats,
  type MinecraftProfile,
  type ModpackFile,
  type Manifest,
  type PlayerInfo,
  type ServerStatus,
  type PlayerExt,
  type ChatMessage,
  type TrackerState,
  type VersionInfo,
  type FabricLoader,
  type InstallProgress,
  type DeviceCodeInfo,
  type LauncherUpdateInfo,
  type BlueMapStatus,
  type PlayerStats,
} from './schemas';

// Tauri interop types
export type {
  LaunchConfig,
  InstallConfig,
  DownloadProgressEvent,
  MinecraftProfileRaw,
  ManifestRaw,
  ServerStatusRaw,
  TrackerStateRaw,
  InstallProgressEvent,
  DeviceCodeInfoRaw,
  LauncherUpdateInfoRaw,
  BlueMapStatusRaw,
  PlayerStatsRaw,
} from './tauri';

// Minecraft types
export type {
  InstallStep,
} from './minecraft';

export {
  INSTALL_STEP_LABELS,
} from './minecraft';

// 3D Model types
export type {
  BoxCoordinates,
  TextureOffset,
  TextureSize,
  ModelBox,
  ModelSubmodel,
  ModelDefinition,
  ModelData,
} from './models';

export {
  isModelData,
  assertModelData,
} from './models';

// Tracker types (re-export from schemas for convenience)
export type {
  TrackerState as TrackerStateType,
  PlayerExt as PlayerExtType,
  ChatMessage as ChatMessageType,
} from './tracker';
