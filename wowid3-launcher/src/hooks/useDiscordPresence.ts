import { useEffect, useRef } from 'react';
import { useDiscord } from './useDiscord';
import { getDetailedServerStatus } from './useTauriCommands';
import { useSettingsStore } from '../stores/settingsStore';

interface PlayerExt {
  name: string;
  uuid: string;
  position?: [number, number, number];
  dimension?: string;
  biome?: string;
}

interface TrackerState {
  online_players: PlayerExt[];
  tps?: number;
  mspt?: number;
  last_updated: number;
}

export const useDiscordPresence = (
  isPlaying: boolean,
  username?: string,
  uuid?: string
) => {
  const { updatePresence, clearPresence, isConnected } = useDiscord();
  const { serverAddress } = useSettingsStore();
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Store start time when playing starts
  useEffect(() => {
    if (isPlaying && !startTimeRef.current) {
      startTimeRef.current = Math.floor(Date.now() / 1000);
    } else if (!isPlaying) {
      startTimeRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Clear presence when game stops
      if (isConnected) {
        clearPresence();
      }
    }
  }, [isPlaying, isConnected, clearPresence]);

  useEffect(() => {
    if (!isPlaying || !isConnected || !username || !uuid) return;

    const updateLoop = async () => {
      try {
        // Default state
        let state = 'Playing WOWID3 Modpack';
        let details = 'In Menu';
        let smallImage: string | undefined = undefined;
        let partySize: number | undefined = undefined;
        let partyMax: number | undefined = undefined;

        // Fetch tracker status
        // We assume the server URL is the HTTP API URL, not the MC server address
        // If serverAddress is "mc.frostdev.io", we might need "https://mc.frostdev.io" or similar
        // For now, let's try to derive it or use a configured API URL.
        // The settings store has serverAddress (e.g. mc.frostdev.io) but maybe not the API URL.
        // We'll assume the API is hosted at the same domain or use a hardcoded fallback for now if not in settings.
        // TODO: Add apiUrl to settings store if needed. For now assuming typical setup.
        
        // Construct API URL from server address (heuristic)
        let apiUrl = serverAddress;
        if (!apiUrl.startsWith('http')) {
             apiUrl = `https://${apiUrl}`; // HTTPS default
        }
        // If it's just a hostname, it might need port 8080 if dev, or 443 if prod.
        // We'll assume the user configured the Modpack Server URL in settings, which is used for updates.
        // Actually, useSettingsStore has `serverAddress` which is for MC server.
        // `modpackStore` uses `updateUrl`.
        // Let's use `updateUrl` base.
        
        // Actually, let's try to fetch from the same host as the modpack update URL.
        // But we don't have access to modpack store here easily without importing.
        // We'll use the hardcoded API URL from the project if available or fallback.
        // The implementation plan didn't specify where to get the API URL. 
        // We'll assume it's 'https://wowid-launcher.frostdev.io' based on other files
        // or try to use the one from settings if possible.
        
        const statusUrl = 'https://wowid-launcher.frostdev.io'; 

        try {
          const trackerState: TrackerState = await getDetailedServerStatus(statusUrl);
          
          // Find current player
          const currentPlayer = trackerState.online_players.find(p => p.uuid === uuid || p.name === username);
          
          partySize = trackerState.online_players.length;
          partyMax = 20; // Default max, or get from somewhere else if available
          
          if (currentPlayer) {
            // Format Dimension
            if (currentPlayer.dimension) {
              const dim = currentPlayer.dimension.replace('minecraft:', '');
              if (dim === 'overworld') state = 'In Overworld';
              else if (dim === 'the_nether') state = 'In The Nether';
              else if (dim === 'the_end') state = 'In The End';
              else state = `Exploring ${dim}`;
              
              // Set small image based on dimension
              if (dim === 'overworld') smallImage = 'grass_block'; // standard icon?
              else if (dim === 'the_nether') smallImage = 'netherrack';
              else if (dim === 'the_end') smallImage = 'end_stone';
            }

            // Format Biome
            if (currentPlayer.biome) {
              const biomeName = currentPlayer.biome
                .replace('minecraft:', '')
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              
              details = `Biome: ${biomeName}`;
              
              // Add coordinates if available
              if (currentPlayer.position) {
                 const [x, y, z] = currentPlayer.position.map(Math.round);
                 details += ` | ${x}, ${y}, ${z}`;
              }
            }
          } else {
            // Player online but not found in tracker? Or maybe just joined.
            details = 'Connecting to server...';
          }
          
        } catch (e) {
          console.warn('Failed to fetch tracker status:', e);
          // Fallback to basic presence
          details = 'Playing on Server';
        }

        await updatePresence(
          details,
          state,
          'wowid3-logo', // Large image key
          smallImage,
          partySize,
          partyMax,
          startTimeRef.current || undefined
        );

      } catch (err) {
        console.error('Error in Discord presence loop:', err);
      }
    };

    // Initial update
    updateLoop();

    // Start interval
    intervalRef.current = window.setInterval(updateLoop, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, isConnected, username, uuid, serverAddress, updatePresence]);
};


