import { ServerStatus } from '../stores';
import { Card } from './ui/Card';

interface PlayerListProps {
  status: ServerStatus;
}

export const PlayerList = ({ status }: PlayerListProps) => {
  if (!status.online || !status.players || status.players.length === 0) {
    return null;
  }

  return (
    <Card>
      <h3 className="text-lg font-bold text-white mb-3">Players Online ({status.players.length})</h3>
      <div className="grid grid-cols-2 gap-2">
        {status.players.map((player, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
          >
            <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-purple-500 rounded flex items-center justify-center text-white text-xs font-bold">
              {player[0].toUpperCase()}
            </div>
            <span className="text-sm text-slate-200 truncate">{player}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
