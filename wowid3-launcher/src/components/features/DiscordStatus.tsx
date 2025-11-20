import { FC } from 'react';

export interface DiscordStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  error?: string | null;
  onReconnect: () => void;
}

export const DiscordStatus: FC<DiscordStatusProps> = ({
  isConnected,
  isConnecting,
  error,
  onReconnect,
}) => {
  return (
    <div
      className="flex-1 flex items-center justify-between p-4 rounded-lg"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: `1px solid ${isConnected ? '#16a34a' : '#dc2626'}`,
      }}
    >
      <div className="flex items-center space-x-3 flex-1">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-600'
          }`}
        />
        <div className="flex-1">
          <span
            className="text-white text-sm"
            style={{
              fontFamily: "'Trebuchet MS', sans-serif",
              fontWeight: 'bold',
            }}
          >
            {isConnected ? 'Discord Connected' : 'Discord Disconnected'}
          </span>
          {error && !isConnected && (
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          )}
        </div>
      </div>
      {!isConnected && (
        <button
          onClick={onReconnect}
          disabled={isConnecting}
          className="ml-4 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded transition-colors whitespace-nowrap"
        >
          {isConnecting ? 'Connecting...' : 'Reconnect'}
        </button>
      )}
    </div>
  );
};