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
        let details = 'In Game';
        let smallImage: string | undefined = undefined;
        let partySize: number | undefined = undefined;
        let partyMax: number | undefined = undefined;

        // Try to fetch tracker status for enhanced presence
        // Use hardcoded API URL - can be made configurable in the future
        const statusUrl = 'https://wowid-launcher.frostdev.io';

        try {
          const trackerState: TrackerState = await getDetailedServerStatus(statusUrl);

          // Find current player
          const currentPlayer = trackerState.online_players.find(p => p.uuid === uuid || p.name === username);

          partySize = trackerState.online_players.length;
          partyMax = 20; // Default max server capacity

          if (currentPlayer) {
            // Format Dimension
            if (currentPlayer.dimension) {
              const dim = currentPlayer.dimension.replace('minecraft:', '');
              if (dim === 'overworld') state = 'In Overworld';
              else if (dim === 'the_nether') state = 'In The Nether';
              else if (dim === 'the_end') state = 'In The End';
              else state = `Exploring ${dim}`;

              // Set small image based on dimension
              if (dim === 'overworld') smallImage = 'grass_block';
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
            // Player not found in tracker yet
            details = 'Connecting to server...';
          }

        } catch (apiError) {
          // API fetch failed - use basic presence without breaking Discord
          console.warn('Failed to fetch detailed server status, using basic presence:', apiError);
          details = 'Playing on WOWID3 Server';
          state = 'Multiplayer Game';
          // Continue with basic presence - don't throw
        }

        // Always attempt to update presence, even if API failed
        try {
          await updatePresence(
            details,
            state,
            'wowid3-logo', // Large image key
            smallImage,
            partySize,
            partyMax,
            startTimeRef.current || undefined
          );
        } catch (presenceError) {
          // Presence update failed - log but don't crash the loop
          console.error('Failed to update Discord presence:', presenceError);
        }

      } catch (err) {
        // Catch-all for any unexpected errors
        console.error('Unexpected error in Discord presence loop:', err);
        // Loop will continue on next interval
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


