import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useModpack, useServer, useDiscord, useMinecraftInstaller } from '../hooks';
import { launchGameWithMetadata } from '../hooks/useTauriCommands';
import { useSettingsStore } from '../stores';
import { useAudioStore } from '../stores/audioStore';
import { useUIStore } from '../stores/uiStore';
import { UserMenu } from './UserMenu';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { ProgressBar } from './ui/ProgressBar';
import { ChangelogViewer } from './ChangelogViewer';
import { PlayerList } from './PlayerList';
import { useToast } from './ui/ToastContainer';
import DeviceCodeModal from './DeviceCodeModal';
import { SkinViewerComponent } from './SkinViewer';
import { CatModel } from './CatModel';
import { MinecraftSetup } from './MinecraftSetup';
import type { DeviceCodeInfo } from '../hooks/useTauriCommands';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function LauncherHome() {
  const { user, isAuthenticated, login, finishDeviceCodeAuth, isLoading: authLoading, error: authError } = useAuth();
  const { installedVersion, latestManifest, updateAvailable, isDownloading, downloadProgress, checkUpdates, install, error: modpackError } = useModpack();
  const { status } = useServer();
  const { ramAllocation, gameDirectory, keepLauncherOpen } = useSettingsStore();
  const { setMuted, setWasPaused } = useAudioStore();
  const { setShowLogViewer } = useUIStore();
  const { addToast } = useToast();
  const { isConnected: discordConnected, isConnecting: discordConnecting, error: discordError, setPresence, clearPresence, connect: connectDiscord } = useDiscord();
  const { versionId, isInstalled: minecraftInstalled } = useMinecraftInstaller();
  const [isLaunching, setIsLaunching] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const hasCheckedForModpack = useRef(false);
  const modpackCheckRetries = useRef(0);
  const lastCheckAttempt = useRef<number>(0);
  const isInstallingRef = useRef(false);
  const hasShownWelcomeToast = useRef(false);
  const lastAuthError = useRef<string | null>(null);
  const lastModpackError = useRef<string | null>(null);

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

  // Display auth errors as toasts (only when error changes)
  useEffect(() => {
    if (authError && authError !== lastAuthError.current) {
      addToast(authError, 'error');
      lastAuthError.current = authError;
    } else if (!authError) {
      lastAuthError.current = null;
    }
  }, [authError]);

  // Display modpack errors as toasts (only when error changes)
  useEffect(() => {
    if (modpackError && modpackError !== lastModpackError.current) {
      addToast(modpackError, 'error');
      lastModpackError.current = modpackError;
    } else if (!modpackError) {
      lastModpackError.current = null;
    }
  }, [modpackError]);

  // Display success feedback when user logs in (once per session)
  useEffect(() => {
    if (isAuthenticated && user && !authLoading && !hasShownWelcomeToast.current) {
      addToast(`Welcome back, ${user.username}!`, 'success');
      hasShownWelcomeToast.current = true;
    }
    // Reset the flag when user logs out
    if (!isAuthenticated) {
      hasShownWelcomeToast.current = false;
    }
  }, [isAuthenticated, user, authLoading]);

  // Auto-check for updates and install modpack after authentication
  useEffect(() => {
    const checkAndInstall = async () => {
      // Guard: Only run once per session after authentication
      if (hasCheckedForModpack.current) {
        return; // Silent skip, already checked successfully
      }

      // Guard: Wait for auth to complete
      if (!isAuthenticated || authLoading || isDownloading) {
        return; // Silent skip, waiting for auth
      }

      // Exponential backoff: Check if we should wait before retrying
      const now = Date.now();
      const timeSinceLastAttempt = now - lastCheckAttempt.current;
      const backoffDelay = Math.min(Math.pow(2, modpackCheckRetries.current) * 1000, 60000); // Max 60 seconds

      if (modpackCheckRetries.current > 0 && timeSinceLastAttempt < backoffDelay) {
        const remainingWait = Math.ceil((backoffDelay - timeSinceLastAttempt) / 1000);
        console.log(`[Modpack] Waiting ${remainingWait}s before retry (attempt ${modpackCheckRetries.current + 1})`);
        return;
      }

      console.log('[Modpack] Checking for updates...');
      lastCheckAttempt.current = now;

      try {
        await checkUpdates();
        console.log('[Modpack] Manifest fetched successfully');
        hasCheckedForModpack.current = true;
        modpackCheckRetries.current = 0; // Reset retry counter on success

      } catch (err) {
        modpackCheckRetries.current += 1;
        const nextRetryDelay = Math.min(Math.pow(2, modpackCheckRetries.current) * 1000, 60000);
        console.error(
          `[Modpack] Failed to check for updates (attempt ${modpackCheckRetries.current}):`,
          err instanceof Error ? err.message : err
        );
        console.log(`[Modpack] Will retry in ${nextRetryDelay / 1000}s`);

        // Don't show toast for network errors on auto-check, just log them
        // The user can manually check from settings if needed
      }
    };

    checkAndInstall();
  }, [isAuthenticated, authLoading, isDownloading, checkUpdates]);

  // Separate effect to handle installation after manifest is fetched
  useEffect(() => {
    const performInstall = async () => {
      // Prevent concurrent installations
      if (isInstallingRef.current) return;

      // Only run if we've checked and there's something to install
      if (!hasCheckedForModpack.current) return;
      if (isDownloading) return;
      if (!latestManifest) return;

      // Check if we need to install
      const needsInstall = !installedVersion || (updateAvailable && installedVersion !== latestManifest.version);

      if (needsInstall) {
        console.error('[Modpack] ==== STARTING AUTO-INSTALL ====');
        console.error('[Modpack] Installed:', installedVersion, 'Latest:', latestManifest.version);

        isInstallingRef.current = true;
        try {
          addToast(installedVersion ? 'Updating modpack...' : 'Installing modpack...', 'info');
          await install();
          addToast('Modpack installed successfully!', 'success');
          console.error('[Modpack] ==== INSTALL COMPLETE ====');
        } catch (err) {
          console.error('[Modpack] ==== INSTALL FAILED ====', err);
          addToast(`Installation failed: ${err}`, 'error');
        } finally {
          isInstallingRef.current = false;
        }
      } else {
        console.error('[Modpack] No install needed. Installed:', installedVersion, 'Latest:', latestManifest?.version);
      }
    };

    performInstall();
  }, [latestManifest, installedVersion, updateAvailable, isDownloading]);

  // Listen for Minecraft events
  useEffect(() => {
    const unlistenLog = listen<{level: string; message: string}>('minecraft-log', (event) => {
      console.log(`[Minecraft ${event.payload.level}]`, event.payload.message);

      // Show important errors as toasts
      if (event.payload.level === 'error') {
        addToast(`Game Error: ${event.payload.message}`, 'error');
      }
    });

    const unlistenExit = listen<{exit_code: number; crashed: boolean}>('minecraft-exit', async (event) => {
      console.log('[Minecraft] Process exited with code:', event.payload.exit_code);
      setIsLaunching(false);

      // Close log viewer (but keep it visible if keepLauncherOpen is true, for debugging)
      if (!keepLauncherOpen) {
        setShowLogViewer(false);

        // Show the launcher window again after game exits
        try {
          console.log('[Window] Showing launcher window after game exit...');
          const appWindow = await getCurrentWindow();
          await appWindow.show();
          console.log('[Window] Window shown successfully');
        } catch (error) {
          console.error('[Window] Failed to show window:', error);
        }
      }

      // Keep music muted after game closes (until launcher is closed and reopened)

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
  }, [discordConnected, clearPresence]);

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

    // Check if Minecraft is installed (shouldn't happen with new UI, but just in case)
    if (!minecraftInstalled || !versionId) {
      console.log('[UI] Minecraft not installed. versionId:', versionId, 'minecraftInstalled:', minecraftInstalled);
      return;
    }

    if (updateAvailable) {
      await install();
    }

    try {
      setIsLaunching(true);

      // Pause and mute background music
      const audioElements = document.querySelectorAll('audio');
      let wasPaused = false;
      audioElements.forEach((audio) => {
        if (!audio.paused) {
          wasPaused = true;
          audio.pause();
        }
      });

      // Use audioStore to manage mute state
      setWasPaused(wasPaused);
      setMuted(true);

      // Handle window and log viewer based on setting
      if (!keepLauncherOpen) {
        // Hide the launcher window (using hide() instead of minimize() for better Wayland support)
        try {
          console.log('[Window] Attempting to hide launcher window...');
          const appWindow = await getCurrentWindow();
          await appWindow.hide();
          console.log('[Window] Window hidden successfully');
        } catch (error) {
          console.error('[Window] Failed to hide window:', error);
          addToast('Failed to hide launcher window', 'error');
        }
      } else {
        // Show log viewer instead
        console.log('[Window] Keeping launcher open, showing log viewer');
        setShowLogViewer(true);
      }

      // Set Discord presence when launching
      if (discordConnected) {
        await setPresence(
          `Playing WOWID3`,
          `${status.online ? `${status.player_count}/${status.max_players} players online` : 'Server offline'}`,
          'minecraft'
        );
      }

      console.log('[UI] Launching Minecraft with version:', versionId);
      await launchGameWithMetadata({
        ram_mb: ramAllocation,
        game_dir: gameDirectory,
        username: user.username,
        uuid: user.uuid,
        access_token: user.access_token,
      }, versionId);

      // Note: isLaunching is now cleared by minecraft-exit event
      // Discord presence is also cleared by minecraft-exit event
    } catch (error) {
      console.error('Failed to launch game:', error);
      addToast(`Failed to launch game: ${error}`, 'error');
      setIsLaunching(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full pt-32 p-0">
        {/* Logo Section */}
      <div className="text-center max-w-2xl mx-auto w-full pb-8 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="WOWID3 Launcher Logo"
          className="w-full h-auto object-contain"
        />
      </div>

      {/* Server MOTD */}
      {status.motd && (
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
          <p className="text-sm motd-text" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
            MOTD: {status.motd}
          </p>
        </div>
      )}

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
        ) : minecraftInstalled ? (
          <div className="p-4 rounded-lg text-center border border-opacity-50" style={{ backgroundColor: 'rgba(8, 91, 46, 0.8)', borderColor: '#cdf1e1ff' }}>
            <p className="font-semibold mb-1" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold' }}>Login Required</p>
            <p className="text-sm" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold' }}>Click "Login" to authenticate with your Microsoft account</p>
          </div>
        ) : null}

        {/* Minecraft Installation or Play Section - Animated */}
        <AnimatePresence mode="wait">
          {!minecraftInstalled ? (
            /* Show installation UI when Minecraft is not installed */
            <motion.div
              key="minecraft-setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="mt-6"
            >
              <MinecraftSetup />
            </motion.div>
          ) : (
            /* Show normal play flow when Minecraft is installed */
            <motion.div
              key="play-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              {/* Update Badge or Download Progress */}
              {isDownloading && downloadProgress ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="p-4"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '0',
                  }}
                >
                  <p className="text-white font-semibold mb-3" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>Installing Update...</p>
                  <ProgressBar
                    current={downloadProgress.current}
                    total={downloadProgress.total}
                    showLabel={true}
                    showPercentage={true}
                  />
                </motion.div>
              ) : updateAvailable ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    backgroundColor: 'rgba(79, 195, 247, 0.15)',
                    border: '1px solid rgba(79, 195, 247, 0.5)',
                  }}
                  className="p-4 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: '#4FC3F7', fontFamily: "'Trebuchet MS', sans-serif" }}>
                        ❄️ Update Available!
                      </p>
                      <p className="text-sm text-gray-300 mt-1" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
                        Version {latestManifest?.version} is ready to install
                      </p>
                    </div>
                    {latestManifest && (
                      <button
                        onClick={() => setShowChangelog(true)}
                        style={{
                          backgroundColor: 'rgba(79, 195, 247, 0.2)',
                          color: '#4FC3F7',
                          border: '1px solid rgba(79, 195, 247, 0.4)',
                          fontFamily: "'Trebuchet MS', sans-serif",
                        }}
                        className="px-3 py-2 text-sm rounded transition-colors whitespace-nowrap ml-4 hover:bg-opacity-50"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(79, 195, 247, 0.3)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(79, 195, 247, 0.2)'}
                      >
                        View Changes
                      </button>
                    )}
                  </div>
                </motion.div>
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
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                className="flex justify-center mt-6"
              >
                <motion.button
                  onClick={handlePlayClick}
                  disabled={isLaunching || isDownloading || authLoading}
                  className="btn-primary text-2xl py-8 px-16 disabled:opacity-50 disabled:cursor-not-allowed btn-gradient-border"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {authLoading && 'Authenticating...'}
                  {!authLoading && isLaunching && 'Launching...'}
                  {!authLoading && isDownloading && 'Updating...'}
                  {!authLoading && !isLaunching && !isDownloading && !isAuthenticated && 'Login'}
                  {!authLoading && !isLaunching && !isDownloading && isAuthenticated && updateAvailable && 'Update'}
                  {!authLoading && !isLaunching && !isDownloading && isAuthenticated && !updateAvailable && 'PLAY'}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player List */}
        <PlayerList status={status} />
        </div>

        {/* Cat Model - Left side */}
        <div className="absolute left-[calc(50%-730px)] top-[-80px]">
          <CatModel />
        </div>

        {/* 3D Skin Viewer - Right side - Only show when authenticated */}
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
        border: `1px solid ${installedVersion && minecraftInstalled ? '#16a34a' : '#dc2626'}`,
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)'
      }}>
        {/* Version Info */}
        <div className="flex justify-between text-sm pb-4 opacity-100" style={{ fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 'bold', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div>
            <span className="text-white">Modpack: </span>
            <span className="ml-2" style={{ color: installedVersion ? '#16a34a' : '#dc2626' }}>
              {installedVersion || 'Not installed'}
            </span>
          </div>
          <div>
            <span className="text-white">Minecraft: </span>
            <span className="ml-2" style={{ color: minecraftInstalled ? '#16a34a' : '#dc2626' }}>
              {minecraftInstalled ? (versionId || 'Installed') : 'Not installed'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: installedVersion ? '#16a34a' : '#dc2626' }}>
              {installedVersion && latestManifest
                ? (latestManifest.files.filter((f: any) => f.path?.endsWith('.jar')).length || 0)
                : 0}
            </p>
            <p className="text-xs text-gray-400">Mods Installed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: installedVersion ? '#16a34a' : '#dc2626' }}>
              {installedVersion && latestManifest && installedVersion === latestManifest.version
                ? latestManifest.minecraft_version
                : 'N/A'}
            </p>
            <p className="text-xs text-gray-400">MC Version</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: installedVersion ? '#16a34a' : '#dc2626' }}>
              {Math.round(ramAllocation / 1024)}GB
            </p>
            <p className="text-xs text-gray-400">Allocated RAM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
