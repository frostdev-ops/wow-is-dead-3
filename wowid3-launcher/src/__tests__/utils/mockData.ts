import type { MinecraftProfile } from '../../stores/authStore';
import type { Manifest } from '../../stores/modpackStore';
import type { ServerStatus } from '../../stores/serverStore';
import type { DeviceCodeInfo } from '../../hooks/useTauriCommands';

// Mock Minecraft profile
export const mockMinecraftProfile: MinecraftProfile = {
  uuid: '12345678-1234-1234-1234-123456789abc',
  username: 'TestPlayer',
  session_id: 'mock_session_id_12345',
  skin_url: 'https://example.com/skin.png',
  expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
};

// Mock device code info
export const mockDeviceCodeInfo: DeviceCodeInfo = {
  device_code: 'mock_device_code_12345',
  user_code: 'ABCD-1234',
  verification_uri: 'https://microsoft.com/devicelogin',
  expires_in: 900,
  interval: 5,
};

// Mock manifest
export const mockManifest: Manifest = {
  version: '1.0.0',
  minecraft_version: '1.20.1',
  fabric_loader: '0.15.0',
  files: [
    {
      path: 'mods/example-mod.jar',
      url: 'https://example.com/files/example-mod.jar',
      sha256: 'abc123def456',
      size: 1024000,
    },
    {
      path: 'config/example-config.json',
      url: 'https://example.com/files/example-config.json',
      sha256: 'def456ghi789',
      size: 2048,
    },
  ],
  changelog: 'Initial release\n- Added example mod\n- Configured example settings',
};

// Mock updated manifest
export const mockUpdatedManifest: Manifest = {
  ...mockManifest,
  version: '1.1.0',
  files: [
    ...mockManifest.files,
    {
      path: 'mods/new-mod.jar',
      url: 'https://example.com/files/new-mod.jar',
      sha256: 'ghi789jkl012',
      size: 512000,
    },
  ],
  changelog: '1.1.0:\n- Added new mod\n- Bug fixes\n\n' + mockManifest.changelog,
};

// Mock server status
export const mockServerStatus: ServerStatus = {
  online: true,
  player_count: 5,
  max_players: 20,
  players: [
    { name: 'Player1', id: 'uuid-1' },
    { name: 'Player2', id: 'uuid-2' },
  ],
  version: '1.20.1',
  motd: 'Welcome to the test server!',
};

// Mock offline server status
export const mockOfflineServerStatus: ServerStatus = {
  online: false,
  player_count: 0,
  max_players: 0,
  players: [],
  version: '',
  motd: '',
};

// Helper to create custom manifest
export const createMockManifest = (overrides?: Partial<Manifest>): Manifest => ({
  ...mockManifest,
  ...overrides,
});

// Helper to create custom profile
export const createMockProfile = (overrides?: Partial<MinecraftProfile>): MinecraftProfile => ({
  ...mockMinecraftProfile,
  ...overrides,
});

// Helper to create custom device code
export const createMockDeviceCode = (overrides?: Partial<DeviceCodeInfo>): DeviceCodeInfo => ({
  ...mockDeviceCodeInfo,
  ...overrides,
});

// Helper to create custom server status
export const createMockServerStatus = (overrides?: Partial<ServerStatus>): ServerStatus => ({
  ...mockServerStatus,
  ...overrides,
});
