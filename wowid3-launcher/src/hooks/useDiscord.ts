import { useEffect, useState, useCallback, useRef } from 'react';
import {
  discordConnect,
  discordSetPresence,
  discordUpdatePresence,
  discordClearPresence,
  discordDisconnect,
  discordIsConnected,
} from './useTauriCommands';
import { useToast } from '../components/ui/ToastContainer';

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_INTERVAL = 30000; // 30 seconds

export const useDiscord = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // Track if we've shown the initial connection status toast
  const hasShownInitialToast = useRef(false);
  const retryCount = useRef(0);
  const retryInterval = useRef<number | null>(null);

  // Attempt to connect to Discord
  const attemptConnection = useCallback(async (showToast = true) => {
    try {
      setIsConnecting(true);

      // First check if already connected
      const connected = await discordIsConnected();
      if (connected) {
        setIsConnected(true);
        setError(null);

        if (showToast && !hasShownInitialToast.current) {
          addToast('Discord Rich Presence connected', 'success', 3000);
          hasShownInitialToast.current = true;
        }

        // Stop retry interval if running
        if (retryInterval.current) {
          clearInterval(retryInterval.current);
          retryInterval.current = null;
          retryCount.current = 0;
        }

        return true;
      }

      // If not connected, attempt to connect
      try {
        await discordConnect();
        setIsConnected(true);
        setError(null);

        if (showToast && !hasShownInitialToast.current) {
          addToast('Discord Rich Presence connected', 'success', 3000);
          hasShownInitialToast.current = true;
        }

        // Stop retry interval if running
        if (retryInterval.current) {
          clearInterval(retryInterval.current);
          retryInterval.current = null;
          retryCount.current = 0;
        }

        return true;
      } catch (connectErr) {
        // Connection failed - Discord might not be running
        setIsConnected(false);
        setError('Discord not running. Launch Discord to enable Rich Presence.');

        if (showToast && !hasShownInitialToast.current) {
          addToast('Discord not detected - Rich Presence unavailable', 'warning', 5000);
          hasShownInitialToast.current = true;
        }

        return false;
      }
    } catch (err) {
      setIsConnected(false);
      setError('Discord unavailable');
      console.warn('Discord initialization failed:', err);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [addToast]);

  // Check and auto-connect to Discord on mount
  useEffect(() => {
    const initializeDiscord = async () => {
      const connected = await attemptConnection(true);

      // If connection failed, start retry interval
      if (!connected && retryCount.current < MAX_RETRY_ATTEMPTS) {
        retryInterval.current = window.setInterval(async () => {
          retryCount.current += 1;

          const success = await attemptConnection(false);

          if (success) {
            addToast('Discord Rich Presence reconnected successfully', 'success', 3000);
          } else if (retryCount.current >= MAX_RETRY_ATTEMPTS) {
            // Stop trying after max attempts
            if (retryInterval.current) {
              clearInterval(retryInterval.current);
              retryInterval.current = null;
            }
          }
        }, RETRY_INTERVAL);
      }
    };

    initializeDiscord();

    // Cleanup on unmount
    return () => {
      if (retryInterval.current) {
        clearInterval(retryInterval.current);
        retryInterval.current = null;
      }
    };
  }, [attemptConnection, addToast]);

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      await discordConnect();
      setIsConnected(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Discord';
      setError(message);
      console.warn('Discord connection failed:', message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const setPresence = useCallback(async (details: string, state: string, largeImage?: string) => {
    try {
      // Note: We can't reliably auto-connect here because connect is async and state updates are async
      // Better to ensure connection before calling setPresence or handle it in the component
      if (!isConnected) {
        await discordConnect(); // Try direct call instead of helper to avoid dep loop if needed, or just trust the helper
        // Update local state manually or rely on next render? 
        // For now, assume connected or will fail gracefully.
      }
      await discordSetPresence(details, state, largeImage);
    } catch (err) {
      console.warn('Failed to set Discord presence:', err);
    }
  }, [isConnected]);

  const updatePresence = useCallback(async (
    details: string,
    state: string,
    largeImage?: string,
    smallImage?: string,
    partySize?: number,
    partyMax?: number,
    startTime?: number
  ) => {
    try {
      if (!isConnected) return;
      await discordUpdatePresence(details, state, largeImage, smallImage, partySize, partyMax, startTime);
    } catch (err) {
      console.warn('Failed to update Discord presence:', err);
    }
  }, [isConnected]);

  const clearPresence = useCallback(async () => {
    try {
      if (!isConnected) return;
      await discordClearPresence();
    } catch (err) {
      console.warn('Failed to clear Discord presence:', err);
    }
  }, [isConnected]);

  const disconnect = useCallback(async () => {
    try {
      await discordDisconnect();
      setIsConnected(false);
    } catch (err) {
      console.warn('Failed to disconnect from Discord:', err);
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    setPresence,
    updatePresence,
    clearPresence,
    disconnect,
  };
};
