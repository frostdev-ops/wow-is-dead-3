import { useState, useEffect, memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ServerStatus, PlayerInfo } from '../stores/serverStore';
import { Card } from './ui/Card';
import { resolvePlayerName } from '../hooks/useTauriCommands';
import { TrackerState, PlayerExt } from '../types/tracker';

interface PlayerListProps {
  status: ServerStatus;
  trackerState?: TrackerState | null;
}

interface AvatarData {
  data: string;
  content_type: string;
}

const PlayerItem = memo(({ player }: { player: PlayerInfo | PlayerExt }) => {
  const [imgError, setImgError] = useState(false);
  const [displayName, setDisplayName] = useState(player.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Use ID for skin if available, otherwise fallback to name
  // @ts-ignore - uuid vs id property difference
  const id = (player as any).id || (player as any).uuid;
  const skinIdentifier = id || player.name;

  // Detailed info (only on PlayerExt)
  const isDetailed = 'biome' in player;
  const biome = (player as PlayerExt).biome;
  const dimension = (player as PlayerExt).dimension;
  const position = (player as PlayerExt).position;

  // Fetch avatar using Tauri backend (bypasses CSP in production)
  useEffect(() => {
    let mounted = true;

    const fetchAvatar = async () => {
      try {
        // Fetch skin from backend
        const data = await invoke<AvatarData>('cmd_fetch_avatar', {
          username: skinIdentifier
        });

        if (!mounted) return;

        // Convert to data URI
        const fullSkinDataUri = `data:${data.content_type};base64,${data.data}`;

        // Load and crop to just the head
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          if (!mounted) return;

          // Create canvas to extract head (8x8 face from skin)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            setImgError(true);
            return;
          }

          // Scale up for crisp rendering
          const scale = 8;
          canvas.width = 8 * scale;
          canvas.height = 8 * scale;
          ctx.imageSmoothingEnabled = false;

          // Extract face (8x8 at position 8,8 in the 64x64 skin)
          ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8 * scale, 8 * scale);

          const headDataUri = canvas.toDataURL('image/png');
          setAvatarUrl(headDataUri);
        };

        img.onerror = () => {
          if (mounted) setImgError(true);
        };

        img.src = fullSkinDataUri;

      } catch (error) {
        console.error('[PlayerList] Failed to fetch avatar:', error);
        if (mounted) setImgError(true);
      }
    };

    fetchAvatar();

    return () => {
      mounted = false;
    };
  }, [skinIdentifier]);

  // Resolve player name
  useEffect(() => {
    if (player.name === 'Anonymous Player' && id) {
      resolvePlayerName(id)
        .then((name) => {
          setDisplayName(name);
        })
        .catch((err) => {
          console.error(`[PlayerList] Failed to resolve name for ${id}:`, err);
        });
    } else {
      setDisplayName(player.name);
    }
  }, [player.name, id]);

  // Format dimension name
  const formatDimension = (dim: string) => {
    const name = dim.split(':')[1] || dim;
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
  };

  // Format biome name
  const formatBiome = (b: string) => {
    const name = b.split(':')[1] || b;
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="group relative flex items-center gap-2 p-2 bg-slate-700 rounded hover:bg-slate-600 transition-colors">
      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-slate-800">
        {!imgError && avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            style={{ imageRendering: 'pixelated' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {displayName[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-200 truncate block font-medium">{displayName}</span>
        {isDetailed && (
            <div className="text-xs text-slate-400 flex flex-col">
              {dimension && <span>{formatDimension(dimension)}</span>}
            </div>
        )}
      </div>
      
      {/* Tooltip for detailed info */}
      {isDetailed && (
        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-black bg-opacity-90 text-white text-xs p-2 rounded z-10 w-max pointer-events-none border border-slate-600 shadow-xl">
          {dimension && <p><span className="text-gray-400">Dimension:</span> {formatDimension(dimension)}</p>}
          {biome && <p><span className="text-gray-400">Biome:</span> {formatBiome(biome)}</p>}
          {position && (
            <p><span className="text-gray-400">Pos:</span> {Math.round(position[0])}, {Math.round(position[1])}, {Math.round(position[2])}</p>
          )}
        </div>
      )}
    </div>
  );
});

const PlayerListBase = ({ status, trackerState }: PlayerListProps) => {
  // Prefer detailed tracker state if available and valid
  const players = trackerState?.online_players?.length 
    ? trackerState.online_players 
    : status?.players || [];
    
  // Check if we have any players to show
  if (!players || players.length === 0) {
    // Only hide if BOTH are empty/offline. If tracker is null but status says online (but 0 players), we might still want to show the card if we trust the count? 
    // But usually 0 players means we hide the list.
    if (!status.online) return null;
    if ((status.player_count || 0) === 0) return null;
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-white">
          Players Online ({players.length})
        </h3>
        {trackerState?.tps && (
          <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            TPS: <span className={trackerState.tps > 18 ? 'text-green-400' : 'text-yellow-400'}>{trackerState.tps.toFixed(1)}</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {players.map((player, idx) => (
          <PlayerItem 
            // @ts-ignore - handling both types with loose access
            key={`${player.id || player.uuid}-${idx}`} 
            player={player} 
          />
        ))}
      </div>
    </Card>
  );
};

// Export memoized PlayerList - only re-renders when status or trackerState changes
export const PlayerList = memo(PlayerListBase, (prevProps, nextProps) => {
  // Custom comparison for optimal performance
  return (
    prevProps.status === nextProps.status &&
    prevProps.trackerState === nextProps.trackerState
  );
});
