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
import { SkinViewerComponent } from './SkinViewer';
import type { DeviceCodeInfo } from '../hooks/useTauriCommands';
import { listen } from '@tauri-apps/api/event';

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

  // Listen for Minecraft events
  useEffect(() => {
    const unlistenLog = listen<{level: string; message: string}>('minecraft-log', (event) => {
      console.log(`[Minecraft ${event.payload.level}]`, event.payload.message);

      // Show important errors as toasts
      if (event.payload.level === 'error') {
        addToast(`Game Error: ${event.payload.message}`, 'error');
      }
    });

    const unlistenExit = listen<{exit_code: number; crashed: boolean}>('minecraft-exit', (event) => {
      console.log('[Minecraft] Process exited with code:', event.payload.exit_code);
      setIsLaunching(false);

      // Clear Discord presence when game exits
      if (discordConnected) {
        clearPresence().catch(console.error);
      }

      if (event.payload.crashed) {
        addToast(`Game crashed with exit code ${event.payload.exit_code}`, 'error');
      } else {
        addToast('Game closed', 'info');
      }
    });

    const unlistenCrash = listen<{message: string}>('minecraft-crash', (event) => {
      console.log('[Minecraft] Crash analysis:', event.payload.message);
      addToast(event.payload.message, 'error');
    });

    return () => {
      unlistenLog.then(f => f());
      unlistenExit.then(f => f());
      unlistenCrash.then(f => f());
    };
  }, [addToast, discordConnected, clearPresence]);

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

      // Note: isLaunching is now cleared by minecraft-exit event
      // Discord presence is also cleared by minecraft-exit event
    } catch (error) {
      console.error('Failed to launch game:', error);
      addToast('Failed to launch game', 'error');
      setIsLaunching(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-0">
        {/* Logo Section */}
      <div className="text-center max-w-2xl mx-auto w-full pb-8 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="WOWID3 Launcher Logo"
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Main Layout Container */}
      <div className="w-full relative flex justify-center px-4">
        {/* Content Card */}
        <div className="card max-w-2xl w-full space-y-2">

        {/* Server Status & Discord */}
        <div className="flex gap-3">
          {/* Server Status */}
          {status ? (
            <div className="flex-1 flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', border: `1px solid ${status.online ? '#16a34a' : '#dc2626'}` }}>
              <div className="flex items-center space-x-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    status.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="text-white text-sm" style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold' }}>
                  {status.online
                    ? `${status.player_count || 0}/${status.max_players || 0} players online`
                    : 'Server Offline'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 bg-black bg-opacity-20 flex justify-center">
              <LoadingSpinner size="sm" message="Checking server..." />
            </div>
          )}

          {/* Discord Status */}
          <div className="flex-1 flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', border: `1px solid ${discordConnected ? '#16a34a' : '#dc2626'}` }}>
            <div className="flex items-center space-x-3 flex-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  discordConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <div className="flex-1">
                <span className="text-white text-sm" style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold' }}>
                  {discordConnected ? 'Discord Connected' : 'Discord Disconnected'}
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

        {/* User Info or Login Prompt */}
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between px-5 py-6 pt-5 mt-4 border border-christmas-gold border-opacity-30 rounded-lg" style={{ backgroundImage: 'linear-gradient(to right, rgba(77, 130, 110, 0.65) 0%, rgba(0, 0, 0, 0.5) 50%, rgba(70, 130, 180, 0.65) 100%)' }}>
            <div className="flex items-center space-x-4">
              <img
                src={`https://mc-heads.net/avatar/${user.username}`}
                alt={user.username}
                className="w-14 h-14 shadow-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <p className="text-white font-bold text-lg">{user.username}</p>
                <p className="text-sm text-christmas-gold">Authenticated</p>
              </div>
            </div>
            <UserMenu user={user} />
          </div>
        ) : authLoading ? (
          <div className="p-4 bg-black bg-opacity-20 rounded-lg flex justify-center border border-slate-600 border-opacity-30">
            <LoadingSpinner size="md" message="Authenticating with Microsoft..." />
          </div>
        ) : (
          <div className="p-4 rounded-lg text-center border border-opacity-50" style={{ backgroundColor: 'rgba(8, 91, 46, 0.8)', borderColor: '#cdf1e1ff' }}>
            <p className="font-semibold mb-1" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold' }}>Login Required</p>
            <p className="text-sm" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold' }}>Click "Login & Play" to authenticate with your Microsoft account</p>
          </div>
        )}

        {/* Update Badge or Download Progress */}
        {isDownloading && downloadProgress ? (
          <div className="bg-black bg-opacity-20 border border-slate-600 p-4">
            <p className="text-white font-semibold mb-3">Installing Update...</p>
            <ProgressBar
              current={downloadProgress.current}
              total={downloadProgress.total}
              showLabel={true}
              showPercentage={true}
            />
          </div>
        ) : updateAvailable ? (
          <div className="bg-christmas-gold bg-opacity-20 border border-christmas-gold p-4">
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
        <div className="flex justify-center mt-6">
          <button
            onClick={handlePlayClick}
            disabled={isLaunching || isDownloading || authLoading}
            className="btn-primary text-2xl py-8 px-16 disabled:opacity-50 disabled:cursor-not-allowed btn-gradient-border"
          >
          {authLoading && 'Authenticating...'}
          {!authLoading && isLaunching && 'Launching...'}
          {!authLoading && isDownloading && 'Updating...'}
          {!authLoading && !isLaunching && !isDownloading && !isAuthenticated && 'Login & Play'}
          {!authLoading && !isLaunching && !isDownloading && isAuthenticated && updateAvailable && 'Update & Play'}
          {!authLoading && !isLaunching && !isDownloading && isAuthenticated && !updateAvailable && 'PLAY'}
          </button>
        </div>

        {/* Server MOTD */}
        {status.online && status.motd && (
          <div className="p-4 bg-slate-700 bg-opacity-50 border border-slate-600">
            <p className="text-xs text-slate-400 mb-1">Server Message</p>
            <p className="text-white text-sm">{status.motd}</p>
          </div>
        )}

        {/* Player List */}
        <PlayerList status={status} />
        </div>

        {/* 3D Skin Viewer - Only show when authenticated */}
        {isAuthenticated && user && (
          <div className="absolute left-[calc(50%+380px)] top-[-80px]">
            <SkinViewerComponent
              username={user.username}
              uuid={user.uuid}
              skinUrl={user.skin_url}
            />
          </div>
        )}
      </div>

      {/* Quick Stats Card */}
      <div className="max-w-2xl w-full mt-4" style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        borderRadius: '0',
        padding: '1.5rem',
        border: `1px solid ${installedVersion ? '#16a34a' : '#dc2626'}`,
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)'
      }}>
        {/* Version Info */}
        <div className="flex justify-center text-sm pb-4 opacity-100" style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <span className="text-white">Installed: </span>
          <span className="ml-2" style={{ color: installedVersion ? '#16a34a' : '#dc2626' }}>
            {installedVersion || 'Not installed'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: installedVersion ? '#16a34a' : '#dc2626' }}>
              {latestManifest?.files.length || 0}
            </p>
            <p className="text-xs text-gray-400">Mods</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: installedVersion ? '#16a34a' : '#dc2626' }}>
              {latestManifest?.minecraft_version || 'N/A'}
            </p>
            <p className="text-xs text-gray-400">MC Version</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: installedVersion ? '#16a34a' : '#dc2626' }}>
              {ramAllocation / 1024}GB
            </p>
            <p className="text-xs text-gray-400">RAM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
