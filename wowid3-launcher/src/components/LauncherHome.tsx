import { useState } from 'react';
import { useAuth, useModpack, useServer, launchGame } from '../hooks';
import { useSettingsStore } from '../stores';

export default function LauncherHome() {
  const { user, isAuthenticated, login } = useAuth();
  const { installedVersion, latestManifest, updateAvailable, isDownloading, install } = useModpack();
  const { status } = useServer();
  const { ramAllocation, gameDirectory } = useSettingsStore();
  const [isLaunching, setIsLaunching] = useState(false);

  const handlePlayClick = async () => {
    if (!isAuthenticated || !user) {
      await login();
      return;
    }

    if (updateAvailable) {
      await install();
    }

    try {
      setIsLaunching(true);
      await launchGame({
        ram_mb: ramAllocation,
        game_dir: gameDirectory,
        username: user.username,
        uuid: user.uuid,
        access_token: user.access_token,
      });
    } catch (error) {
      console.error('Failed to launch game:', error);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="card max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-christmas-gold">
            WOWID3 Launcher
          </h1>
          <p className="text-christmas-snow text-opacity-80">
            Christmas Edition 🎄
          </p>
        </div>

        {/* User Info */}
        {isAuthenticated && user && (
          <div className="flex items-center justify-center space-x-4 p-4 bg-black bg-opacity-20 rounded-lg">
            <div className="w-12 h-12 bg-christmas-green rounded-full flex items-center justify-center text-white font-bold">
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold">{user.username}</p>
              <p className="text-sm text-gray-400">{user.uuid}</p>
            </div>
          </div>
        )}

        {/* Server Status */}
        <div className="flex items-center justify-between p-4 bg-black bg-opacity-20 rounded-lg">
          <div className="flex items-center space-x-3">
            <div
              className={`w-3 h-3 rounded-full ${
                status.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-white">
              {status.online
                ? `${status.player_count || 0}/${status.max_players || 0} players online`
                : 'Server Offline'}
            </span>
          </div>
        </div>

        {/* Version Info */}
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-gray-400">Installed: </span>
            <span className="text-white font-mono">
              {installedVersion || 'Not installed'}
            </span>
          </div>
          {latestManifest && (
            <div>
              <span className="text-gray-400">Latest: </span>
              <span className="text-christmas-gold font-mono">
                {latestManifest.version}
              </span>
            </div>
          )}
        </div>

        {/* Update Badge */}
        {updateAvailable && (
          <div className="bg-christmas-gold bg-opacity-20 border border-christmas-gold rounded-lg p-3 text-center">
            <p className="text-christmas-gold font-semibold">
              🎁 Update Available!
            </p>
            <p className="text-sm text-gray-300 mt-1">
              Version {latestManifest?.version} is ready to install
            </p>
          </div>
        )}

        {/* Play Button */}
        <button
          onClick={handlePlayClick}
          disabled={isLaunching || isDownloading}
          className="w-full btn-primary text-2xl py-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLaunching && '🚀 Launching...'}
          {isDownloading && '⏬ Updating...'}
          {!isLaunching && !isDownloading && !isAuthenticated && '🔐 Login & Play'}
          {!isLaunching && !isDownloading && isAuthenticated && updateAvailable && '🎁 Update & Play'}
          {!isLaunching && !isDownloading && isAuthenticated && !updateAvailable && '▶️ PLAY'}
        </button>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-christmas-gold border-opacity-20">
          <div className="text-center">
            <p className="text-2xl font-bold text-christmas-gold">
              {latestManifest?.files.length || 0}
            </p>
            <p className="text-xs text-gray-400">Mods</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-christmas-green">
              {latestManifest?.minecraft_version || 'N/A'}
            </p>
            <p className="text-xs text-gray-400">MC Version</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-christmas-red">
              {ramAllocation / 1024}GB
            </p>
            <p className="text-xs text-gray-400">RAM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
