import { FC } from 'react';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export interface ServerStatusProps {
  status?: {
    online: boolean;
    player_count?: number;
    max_players?: number;
    motd?: string;
  };
  isLoading?: boolean;
}

export const ServerStatus: FC<ServerStatusProps> = ({ status, isLoading }) => {
  if (isLoading || !status) {
    return (
      <div className="flex-1 p-4 bg-black bg-opacity-20 flex justify-center">
        <LoadingSpinner size="sm" message="Checking server..." />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex items-center justify-between p-4 rounded-lg"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: `1px solid ${status.online ? '#16a34a' : '#dc2626'}`,
      }}
    >
      <div className="flex items-center space-x-3">
        <div
          className={`w-3 h-3 rounded-full ${
            status.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
        />
        <span
          className="text-white text-sm"
          style={{
            fontFamily: "'Trebuchet MS', sans-serif",
            fontWeight: 'bold',
          }}
        >
          {status.online
            ? `${status.player_count || 0}/${status.max_players || 0} players online`
            : 'Server Offline'}
        </span>
      </div>
    </div>
  );
};

export const ServerMOTD: FC<{ motd?: string }> = ({ motd }) => {
  if (!motd) return null;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 mb-6 text-center">
      <style>{`
        @keyframes motd-glow {
          0%, 100% {
            text-shadow: 0 0 5px #FFD700, 0 0 10px #FFD700;
          }
          50% {
            text-shadow: 0 0 15px #FFD700, 0 0 25px #FFD700;
          }
        }
        .motd-text {
          color: #FFD700;
          animation: motd-glow 2s ease-in-out infinite;
        }
      `}</style>
      <p
        className="text-sm motd-text"
        style={{ fontFamily: "'Trebuchet MS', sans-serif" }}
      >
        MOTD: {motd}
      </p>
    </div>
  );
};