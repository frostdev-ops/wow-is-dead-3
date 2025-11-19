import { useState, useEffect } from 'react';
import { ServerStatus, PlayerInfo } from '../stores/serverStore';
import { Card } from './ui/Card';
import { resolvePlayerName } from '../hooks/useTauriCommands';

interface PlayerListProps {
  status: ServerStatus;
}

const PlayerItem = ({ player }: { player: PlayerInfo }) => {
  const [imgError, setImgError] = useState(false);
  const [displayName, setDisplayName] = useState(player.name);

  // Use ID for skin if available, otherwise fallback to name
  const skinIdentifier = player.id || player.name;

  useEffect(() => {
    console.log('[PlayerList] Processing player:', player);
    
    // If the name is "Anonymous Player" and we have an ID, try to resolve the real name
    if (player.name === 'Anonymous Player' && player.id) {
      console.log('[PlayerList] Attempting to resolve name for UUID:', player.id);
      resolvePlayerName(player.id)
        .then((name) => {
          console.log('[PlayerList] Resolved name:', name);
          setDisplayName(name);
        })
        .catch((err) => {
          console.error(`[PlayerList] Failed to resolve name for ${player.id}:`, err);
        });
    } else {
      setDisplayName(player.name);
    }
  }, [player.name, player.id]);

  return (
    <div className="flex items-center gap-2 p-2 bg-slate-700 rounded hover:bg-slate-600 transition-colors">
      <div className="w-6 h-6 rounded overflow-hidden flex-shrink-0 bg-slate-800">
        {!imgError ? (
          <img
            src={`https://minotar.net/helm/${skinIdentifier}/64.png`}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {displayName[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      <span className="text-sm text-slate-200 truncate">{displayName}</span>
    </div>
  );
};

export const PlayerList = ({ status }: PlayerListProps) => {
  if (!status.online || !status.players || status.players.length === 0) {
    return null;
  }

  return (
    <Card>
      <h3 className="text-lg font-bold text-white mb-3">Players Online ({status.players.length})</h3>
      <div className="grid grid-cols-2 gap-2">
        {status.players.map((player, idx) => (
          <PlayerItem key={`${player.id}-${idx}`} player={player} />
        ))}
      </div>
    </Card>
  );
};
