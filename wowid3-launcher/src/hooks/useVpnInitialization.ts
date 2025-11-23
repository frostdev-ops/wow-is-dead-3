import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useVpnStore } from '../stores/vpnStore';

/**
 * Hook to initialize VPN tunnel on app startup if enabled
 * This runs once when the app loads and checks if VPN should be auto-started
 */
export const useVpnInitialization = () => {
  const enabled = useVpnStore((state) => state.enabled);
  const setStatus = useVpnStore((state) => state.setStatus);
  const setError = useVpnStore((state) => state.setError);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initializeVpn = async () => {
      // Only proceed if VPN is enabled
      if (!enabled) {
        console.log('[VPN] VPN is disabled, skipping initialization');
        return;
      }

      console.log('[VPN] VPN is enabled, checking tunnel status...');
      setStatus('connecting');

      try {
        // Check if VPN is configured (has keypair)
        const hasKeypair = await invoke<boolean>('vpn_has_keypair');

        if (!hasKeypair) {
          console.warn('[VPN] VPN enabled but no keypair found - user needs to complete setup');
          setStatus('error');
          setError('VPN configuration missing. Please disable and re-enable VPN in settings to complete setup.');
          return;
        }

        // Check tunnel status
        const tunnelStatus = await invoke<string>('vpn_tunnel_status');
        console.log('[VPN] Tunnel status:', tunnelStatus);

        if (tunnelStatus === 'not_installed') {
          console.warn('[VPN] WireGuard not installed');
          setStatus('error');
          setError('WireGuard is not installed. Please install WireGuard from wireguard.com');
          return;
        }

        if (tunnelStatus === 'running') {
          console.log('[VPN] Tunnel already running');
          setStatus('connected');
          return;
        }

        // Tunnel exists but not running, start it
        if (tunnelStatus === 'stopped') {
          console.log('[VPN] Starting VPN tunnel...');
          await invoke('vpn_start_tunnel');
          console.log('[VPN] VPN tunnel started successfully');
          setStatus('connected');
          return;
        }

        // Unknown status
        console.warn('[VPN] Unknown tunnel status:', tunnelStatus);
        setStatus('error');
        setError(`Unknown VPN status: ${tunnelStatus}`);
      } catch (error) {
        console.error('[VPN] Failed to initialize VPN:', error);
        setStatus('error');
        setError(error instanceof Error ? error.message : 'Failed to start VPN tunnel');
      }
    };

    initializeVpn();
  }, [enabled, setStatus, setError]);
};
