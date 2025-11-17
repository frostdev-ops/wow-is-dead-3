import { useState, useEffect } from 'react';
import { useAuth, useModpack, useServer, useDiscord, launchGame } from '../hooks';
import { useSettingsStore } from '../stores';
import { UserMenu } from './UserMenu';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { ProgressBar } from './ui/ProgressBar';
import { ChangelogViewer } from './ChangelogViewer';
import { PlayerList } from './PlayerList';
import { useToast } from './ui/ToastContainer';
import DeviceCodeModal from './DeviceCodeModal';
import type { DeviceCodeInfo } from '../hooks/useTauriCommands';

export default function LauncherHome() {
  const { user, isAuthenticated, login, finishDeviceCodeAuth, isLoading: authLoading, error: authError } = useAuth();
  const { installedVersion, latestManifest, updateAvailable, isDownloading, downloadProgress, install, error: modpackError } = useModpack();
  const { status } = useServer();
  const { ramAllocation, gameDirectory } = useSettingsStore();
  const { addToast } = useToast();
  const { isConnected: discordConnected, isConnecting: discordConnecting, error: discordError, setPresence, clearPresence, connect: connectDiscord } = useDiscord();
  const [isLaunching, setIsLaunching] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);

  // Debug logging for auth state
  useEffect(() => {
    console.log('[UI State] Auth state changed:', {
      isAuthenticated,
      user: user?.username,
      authLoading,
      isLaunching,
      isDownloading,
      updateAvailable,
    });
  }, [isAuthenticated, user, authLoading, isLaunching, isDownloading, updateAvailable]);

  // Display auth errors as toasts
  useEffect(() => {
    if (authError) {
      addToast(authError, 'error');
    }
  }, [authError, addToast]);

  // Display modpack errors as toasts
  useEffect(() => {
    if (modpackError) {
      addToast(modpackError, 'error');
    }
  }, [modpackError, addToast]);

  // Display success feedback when user logs in
  useEffect(() => {
    if (isAuthenticated && user && !authLoading) {
      addToast(`Welcome back, ${user.username}!`, 'success');
    }
  }, [isAuthenticated, user, authLoading, addToast]);

  const handlePlayClick = async () => {
    console.log('[UI] Play button clicked. isAuthenticated:', isAuthenticated, 'user:', user);
    if (!isAuthenticated || !user) {
      console.log('[UI] Not authenticated, starting login...');
      try {
        const deviceCode = await login();
        if (deviceCode) {
          setDeviceCodeInfo(deviceCode);
          // Start polling for authentication completion
          finishDeviceCodeAuth(deviceCode.device_code, deviceCode.interval)
            .then(() => {
              setDeviceCodeInfo(null);
              addToast('Authentication successful!', 'success');
            })
            .catch((err) => {
              setDeviceCodeInfo(null);
              console.error('[UI] Device code auth failed:', err);
            });
        }
      } catch (err) {
        console.error('[UI] Failed to start device code auth:', err);
      }
      return;
    }

    if (updateAvailable) {
      await install();
    }

    try {
      setIsLaunching(true);

      // Set Discord presence when launching
      if (discordConnected) {
        await setPresence(
          `Playing WOWID3`,
          `${status.online ? `${status.player_count}/${status.max_players} players online` : 'Server offline'}`,
          'minecraft'
        );
      }

      await launchGame({
        ram_mb: ramAllocation,
        game_dir: gameDirectory,
        username: user.username,
        uuid: user.uuid,
        access_token: user.access_token,
      });
    } catch (error) {
      console.error('Failed to launch game:', error);
      addToast('Failed to launch game', 'error');
    } finally {
      setIsLaunching(false);
      // Clear Discord presence when game closes
      if (discordConnected) {
        await clearPresence();
      }
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

        {/* User Info or Login Prompt */}
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between p-5 bg-gradient-to-r from-christmas-green from-10% via-black via-50% to-christmas-gold to-90% bg-opacity-20 rounded-lg border border-christmas-gold border-opacity-30">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gradient-to-br from-christmas-green to-christmas-gold rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {user.username[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-bold text-lg">{user.username}</p>
                <p className="text-sm text-christmas-gold">✓ Authenticated</p>
              </div>
            </div>
            <UserMenu user={user} />
          </div>
        ) : authLoading ? (
          <div className="p-4 bg-black bg-opacity-20 rounded-lg flex justify-center border border-slate-600 border-opacity-30">
            <LoadingSpinner size="md" message="Authenticating with Microsoft..." />
          </div>
        ) : (
          <div className="p-4 bg-slate-700 bg-opacity-50 rounded-lg text-center text-slate-300 border border-slate-600 border-opacity-50">
            <p className="font-semibold mb-1">Login Required</p>
            <p className="text-sm">Click "Login & Play" to authenticate with your Microsoft account</p>
          </div>
        )}

        {/* Server Status & Discord */}
        <div className="space-y-3">
          {/* Server Status */}
          {status ? (
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
          ) : (
            <div className="p-4 bg-black bg-opacity-20 rounded-lg flex justify-center">
              <LoadingSpinner size="sm" message="Checking server..." />
            </div>
          )}

          {/* Discord Status */}
          <div className="flex items-center justify-between p-4 bg-black bg-opacity-20 rounded-lg">
            <div className="flex items-center space-x-3 flex-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  discordConnected ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <div className="flex-1">
                <span className="text-white text-sm">
                  {discordConnected ? '✓ Discord Connected' : '○ Discord Disconnected'}
                </span>
                {discordError && !discordConnected && (
                  <p className="text-xs text-slate-400 mt-1">{discordError}</p>
                )}
              </div>
            </div>
            {!discordConnected && (
              <button
                onClick={connectDiscord}
                disabled={discordConnecting}
                className="ml-4 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded transition-colors whitespace-nowrap"
              >
                {discordConnecting ? 'Connecting...' : 'Reconnect'}
              </button>
            )}
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

        {/* Update Badge or Download Progress */}
        {isDownloading && downloadProgress ? (
          <div className="bg-black bg-opacity-20 border border-slate-600 rounded-lg p-4">
            <p className="text-white font-semibold mb-3">Installing Update...</p>
            <ProgressBar
              current={downloadProgress.current}
              total={downloadProgress.total}
              showLabel={true}
              showPercentage={true}
            />
          </div>
        ) : updateAvailable ? (
          <div className="bg-christmas-gold bg-opacity-20 border border-christmas-gold rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-christmas-gold font-semibold">
                  🎁 Update Available!
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  Version {latestManifest?.version} is ready to install
                </p>
              </div>
              {latestManifest && (
                <button
                  onClick={() => setShowChangelog(true)}
                  className="px-3 py-2 text-sm bg-christmas-gold bg-opacity-30 hover:bg-opacity-50 text-christmas-gold rounded transition-colors whitespace-nowrap ml-4"
                >
                  View Changes
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Changelog Viewer Modal */}
        {latestManifest && (
          <ChangelogViewer
            currentVersion={installedVersion || 'Unknown'}
            manifest={latestManifest}
            isOpen={showChangelog}
            onClose={() => setShowChangelog(false)}
          />
        )}

        {/* Device Code Modal */}
        {deviceCodeInfo && (
          <DeviceCodeModal
            deviceCodeInfo={deviceCodeInfo}
            onCancel={() => setDeviceCodeInfo(null)}
          />
        )}

        {/* Play Button */}
        <button
          onClick={handlePlayClick}
          disabled={isLaunching || isDownloading || authLoading}
          className="w-full btn-primary text-2xl py-6 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {authLoading && '⏳ Authenticating...'}
          {!authLoading && isLaunching && '🚀 Launching...'}
          {!authLoading && isDownloading && '⏬ Updating...'}
          {!authLoading && !isLaunching && !isDownloading && !isAuthenticated && '🔐 Login & Play'}
          {!authLoading && !isLaunching && !isDownloading && isAuthenticated && updateAvailable && '🎁 Update & Play'}
          {!authLoading && !isLaunching && !isDownloading && isAuthenticated && !updateAvailable && '▶️ PLAY'}
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

        {/* Server MOTD */}
        {status.online && status.motd && (
          <div className="p-4 bg-slate-700 bg-opacity-50 rounded-lg border border-slate-600">
            <p className="text-xs text-slate-400 mb-1">Server Message</p>
            <p className="text-white text-sm">{status.motd}</p>
          </div>
        )}

        {/* Player List */}
        <PlayerList status={status} />
      </div>
    </div>
  );
}
