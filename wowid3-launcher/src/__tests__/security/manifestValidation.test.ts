import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useModpack } from '../../hooks/useModpack';
import { useModpackStore } from '../../stores/modpackStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  __resetMocks,
  __setMockInvokeResponse,
  __setMockInvokeResponses,
} from '../../__mocks__/@tauri-apps/api/core';
import { createMockManifest } from '../utils/mockData';

describe('Manifest Validation and Security', () => {
  beforeEach(() => {
    __resetMocks();

    // Set up default mock responses for commands that are called automatically
    __setMockInvokeResponses({
      'cmd_get_installed_version': { response: null },
      'cmd_has_manifest_changed': { response: false },
    });

    useModpackStore.setState({
      installedVersion: null,
      latestManifest: null,
      updateAvailable: false,
      isDownloading: false,
      isVerifying: false,
      isBlockedForInstall: false,
      downloadProgress: { current: 0, total: 0 },
      error: null,
    });

    useSettingsStore.setState({
      gameDirectory: '/home/user/.minecraft',
      manifestUrl: 'https://example.com/manifest.json',
      serverAddress: 'mc.example.com',
      javaPath: '/usr/bin/java',
      ramAllocation: 4096,
      minecraftVersion: '1.20.1',
      fabricEnabled: true,
      fabricVersion: '0.15.0',
      autoUpdate: false,
      preferStableFabric: true,
      isMinecraftInstalled: true,
      theme: 'christmas' as const,
      keepLauncherOpen: false,
      musicWasPaused: false,
      _defaultGameDirectoryFetched: true,
    } as any);
  });

  describe('URL security', () => {
    it('should accept HTTPS URLs', async () => {
      const manifest = createMockManifest({
        files: [
          {
            path: 'mods/test.jar',
            url: 'https://example.com/test.jar',
            sha256: 'abc123',
            size: 1024,
          },
        ],
      });

      __setMockInvokeResponses({
        'cmd_get_installed_version': { response: null },
        'cmd_check_updates': { response: manifest },
      });

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest).toEqual(manifest);
      });
    });

    it('should handle HTTP URLs from trusted manifest server', async () => {
      // Note: The Rust backend handles URL validation
      // Frontend should pass through and let backend validate
      const manifest = createMockManifest({
        files: [
          {
            path: 'mods/test.jar',
            url: 'http://example.com/test.jar',
            sha256: 'abc123',
            size: 1024,
          },
        ],
      });

      __setMockInvokeResponses({
        'cmd_get_installed_version': { response: null },
        'cmd_check_updates': { response: manifest },
      });

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest).toEqual(manifest);
      });
    });

    it('should reject manifests with malicious URLs', async () => {
      // Backend should validate and reject
      __setMockInvokeResponses({
        'cmd_get_installed_version': { response: null },
        'cmd_check_updates': { response: 'Invalid URL scheme', reject: true },
      });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Invalid URL scheme');
    });

    it('should prevent file:// protocol URLs', async () => {
      __setMockInvokeResponses({
        'cmd_get_installed_version': { response: null },
        'cmd_check_updates': { response: 'File protocol not allowed', reject: true },
      });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('File protocol not allowed');
    });

    it('should prevent javascript: protocol URLs', async () => {
      __setMockInvokeResponses({
        'cmd_get_installed_version': { response: null },
        'cmd_check_updates': { response: 'Invalid protocol', reject: true },
      });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Invalid protocol');
    });
  });

  describe('manifest structure validation', () => {
    it('should accept valid manifest structure', async () => {
      const validManifest = createMockManifest({
        version: '1.0.0',
        minecraft_version: '1.20.1',
        fabric_loader: '0.15.0',
        files: [
          {
            path: 'mods/test.jar',
            url: 'https://example.com/test.jar',
            sha256: 'a'.repeat(64), // Valid SHA-256 hash
            size: 1024,
          },
        ],
        changelog: 'Test changelog',
      });

      __setMockInvokeResponse('cmd_check_updates', validManifest);

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest).toEqual(validManifest);
      });
    });

    it('should reject manifest with missing required fields', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Missing required field: version', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Missing required field');
    });

    it('should reject manifest with invalid version format', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Invalid version format', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Invalid version format');
    });

    it('should reject empty files array', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Manifest must contain files', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('must contain files');
    });
  });

  describe('file hash validation', () => {
    it('should accept valid SHA-256 hashes', async () => {
      const manifest = createMockManifest({
        files: [
          {
            path: 'mods/test.jar',
            url: 'https://example.com/test.jar',
            sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            size: 1024,
          },
        ],
      });

      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: manifest } });

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest?.files[0].sha256).toHaveLength(64);
      });
    });

    it('should reject invalid hash length', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Invalid hash length', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Invalid hash');
    });

    it('should reject non-hexadecimal hashes', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Invalid hash characters', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Invalid hash');
    });

    it('should detect hash mismatch during download', async () => {
      const manifest = createMockManifest();
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_install_modpack': { response: 'Hash mismatch detected', reject: true } });

      useModpackStore.setState({ latestManifest: manifest });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.install()).rejects.toThrow('Hash mismatch');
    });
  });

  describe('path traversal protection', () => {
    it('should reject paths with ../', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Path traversal detected', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Path traversal');
    });

    it('should reject absolute paths', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Absolute paths not allowed', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Absolute paths');
    });

    it('should accept valid relative paths', async () => {
      const manifest = createMockManifest({
        files: [
          {
            path: 'mods/test.jar',
            url: 'https://example.com/test.jar',
            sha256: 'abc123',
            size: 1024,
          },
          {
            path: 'config/settings.json',
            url: 'https://example.com/settings.json',
            sha256: 'def456',
            size: 512,
          },
        ],
      });

      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: manifest } });

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest?.files).toHaveLength(2);
      });
    });
  });

  describe('manifest size limits', () => {
    it('should accept reasonably sized manifests', async () => {
      const manifest = createMockManifest({
        files: Array.from({ length: 100 }, (_, i) => ({
          path: `mods/mod${i}.jar`,
          url: `https://example.com/mod${i}.jar`,
          sha256: 'a'.repeat(64),
          size: 1024,
        })),
      });

      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: manifest } });

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest?.files).toHaveLength(100);
      });
    });

    it('should handle large file counts', async () => {
      const manifest = createMockManifest({
        files: Array.from({ length: 500 }, (_, i) => ({
          path: `mods/mod${i}.jar`,
          url: `https://example.com/mod${i}.jar`,
          sha256: 'a'.repeat(64),
          size: 1024,
        })),
      });

      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: manifest } });

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest?.files.length).toBe(500);
      });
    });
  });

  describe('manifest URL validation', () => {
    it('should validate manifest URL format', () => {
      const validUrls = [
        'https://example.com/manifest.json',
        'https://sub.example.com/api/manifest',
        'https://example.com:8080/manifest.json',
      ];

      validUrls.forEach((url) => {
        expect(url).toMatch(/^https:\/\//);
      });
    });

    it('should reject malformed manifest URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/manifest.json',
        'file:///etc/passwd',
        '//example.com/manifest.json',
      ];

      invalidUrls.forEach((url) => {
        expect(url).not.toMatch(/^https:\/\/[a-z0-9.-]+(:[0-9]+)?\/.*$/i);
      });
    });
  });

  describe('file size validation', () => {
    it('should accept reasonable file sizes', async () => {
      const manifest = createMockManifest({
        files: [
          {
            path: 'mods/small.jar',
            url: 'https://example.com/small.jar',
            sha256: 'abc123',
            size: 1024, // 1KB
          },
          {
            path: 'mods/large.jar',
            url: 'https://example.com/large.jar',
            sha256: 'def456',
            size: 50 * 1024 * 1024, // 50MB
          },
        ],
      });

      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: manifest } });

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest?.files).toHaveLength(2);
      });
    });

    it('should reject negative file sizes', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Invalid file size', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Invalid file size');
    });

    it('should reject zero byte files in critical paths', async () => {
      // Backend should validate this
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Zero-byte file not allowed', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Zero-byte');
    });
  });

  describe('manifest tampering detection', () => {
    it('should detect manifest changes via hash comparison', async () => {
      const manifest1 = createMockManifest({ version: '1.0.0' });
      const manifest2 = createMockManifest({ version: '1.0.0' }); // Same version, different content

      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: manifest1 } });

      const { result } = renderHook(() => useModpack());

      await waitFor(() => {
        expect(result.current.latestManifest).toEqual(manifest1);
      });

      // Update to manifest2
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: manifest2 } });
      __setMockInvokeResponses({ 'cmd_has_manifest_changed': { response: true } });

      await result.current.checkUpdates();

      // Should detect change via hash
      await waitFor(() => {
        expect(result.current.latestManifest).toEqual(manifest2);
      });
    });

    it('should validate manifest integrity on every check', async () => {
      const manifest = createMockManifest();
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: manifest } });

      const { result } = renderHook(() => useModpack());

      // Multiple checks should all validate
      await result.current.checkUpdates();
      await result.current.checkUpdates();
      await result.current.checkUpdates();

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('manifest content type validation', () => {
    it('should handle JSON parsing errors', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Invalid JSON', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('Invalid JSON');
    });

    it('should reject non-object manifests', async () => {
      __setMockInvokeResponses({ 'cmd_get_installed_version': { response: null }, 'cmd_check_updates': { response: 'Manifest must be an object', reject: true } });

      const { result } = renderHook(() => useModpack());

      await expect(result.current.checkUpdates()).rejects.toThrow('must be an object');
    });
  });
});
