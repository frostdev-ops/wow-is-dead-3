import { useEffect, useState, useCallback } from 'react';
import {
  discordConnect,
  discordSetPresence,
  discordUpdatePresence,
  discordClearPresence,
  discordDisconnect,
  discordIsConnected,
} from './useTauriCommands';

export const useDiscord = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check and auto-connect to Discord on mount
  useEffect(() => {
    const initializeDiscord = async () => {
      try {
        setIsConnecting(true);
        // First check if already connected
        const connected = await discordIsConnected();
        if (connected) {
          setIsConnected(true);
          setError(null);
          return;
        }

        // If not connected, attempt to connect
        try {
          await discordConnect();
          setIsConnected(true);
          setError(null);
          console.log('Discord connected successfully');
        } catch (connectErr) {
          // Connection failed, but this is okay - Discord might not be running
          setIsConnected(false);
          setError('Discord not running. Launch Discord to enable Rich Presence.');
          console.warn('Discord not available or not running:', connectErr);
        }
      } catch (err) {
        setIsConnected(false);
        setError('Discord unavailable');
        console.warn('Discord initialization failed:', err);
      } finally {
        setIsConnecting(false);
      }
    };

    initializeDiscord();
  }, []);

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
