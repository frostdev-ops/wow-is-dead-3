import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useModpack, useServer, useDiscord, useMinecraftInstaller, useDiscordPresence } from '../hooks';
import { useServerTracker } from '../hooks/useServerTracker';
import { extractBaseUrl } from '../utils/url';
import { 
  useRamAllocation, 
  useManifestUrl
} from '../stores/selectors';
import { useToast } from './ui/ToastContainer';
import { ProgressBar } from './ui/ProgressBar';
import { ChangelogViewer } from './ChangelogViewer';
import { PlayerList } from './PlayerList';
import DeviceCodeModal from './DeviceCodeModal';
import { SkinViewerWithSuspense, CatModelWithSuspense } from './LazyComponents';
import { MinecraftSetup } from './MinecraftSetup';
import { AuthenticationCard } from './features/AuthenticationCard';
import { ModpackStatus } from './features/ModpackStatus';
import { ServerStatus, ServerMOTD } from './features/ServerStatus';
import { DiscordStatus } from './features/DiscordStatus';
import { PlayButton, usePlayButtonState } from './features/PlayButton';
import { useGameLauncher } from '../hooks/useGameLauncher';
import { useModpackLifecycle } from '../hooks/useModpackLifecycle';
import type { DeviceCodeInfo } from '../hooks/useTauriCommands';

export default function LauncherHome() {
  // Global State
  const { user, isAuthenticated, login, finishDeviceCodeAuth, isLoading: authLoading, error: authError } = useAuth();
  const { status } = useServer();
  const ramAllocation = useRamAllocation();
  const manifestUrl = useManifestUrl();
  
  const { state: trackerState } = useServerTracker(extractBaseUrl(manifestUrl));
  const { addToast } = useToast();
  const { isConnected: discordConnected, isConnecting: discordConnecting, error: discordError, connect: connectDiscord } = useDiscord();
  const { versionId, isInstalled: minecraftInstalled } = useMinecraftInstaller();
  
  // Modpack Store (direct access for UI that hasn't been refactored yet)
  const {
    installedVersion,
    latestManifest,
    updateAvailable,
    isDownloading,
    isBlockedForInstall,
    downloadProgress,
    checkUpdates
  } = useModpack();

  // Local State
  const [showChangelog, setShowChangelog] = useState(false);
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const lastAuthError = useRef<string | null>(null);

  // Feature Hooks
  const { 
    isLaunching, 
    isPlaying, 
    error: launchError, 
    launchGame, 
    clearError: clearLaunchError 
  } = useGameLauncher();

  const { 
    state: modpackState, 
    checkAndInstall, 
    performInstall,
    performVerify,
    clearError: clearModpackError,
    clearBackgroundErrors
  } = useModpackLifecycle(isAuthenticated, authLoading);
  

  // Derived State
  const playButtonState = useMemo(() => usePlayButtonState({
    authLoading,
    isLaunching,
    isPlaying,
    isBlockedForInstall,
    isDownloading,
    isAuthenticated,
    updateAvailable
  }), [
    authLoading,
    isLaunching,
    isPlaying,
    isBlockedForInstall,
    isDownloading,
    isAuthenticated,
    updateAvailable
  ]);

  // Effects

  // 1. Discord Presence
  useDiscordPresence(isPlaying, user?.username, user?.uuid);

  // 2. Auth Error Toast
  useEffect(() => {
    const currentErrorMsg = authError?.message || null;
    if (authError && currentErrorMsg !== lastAuthError.current) {
      addToast(authError.userMessage || authError.message, 'error');
      lastAuthError.current = currentErrorMsg;
    } else if (!authError) {
      lastAuthError.current = null;
    }
  }, [authError, addToast]);

  // 3. Launch Error Toast
  useEffect(() => {
    if (launchError) {
      addToast(launchError.message, 'error');
      clearLaunchError();
    }
  }, [launchError, addToast, clearLaunchError]);

  // 4. Modpack Error Toast
  useEffect(() => {
    if (modpackState.error) {
      addToast(modpackState.error.message, 'error');
      clearModpackError();
    }
  }, [modpackState.error, addToast, clearModpackError]);

  // 5. Check updates on mount/auth
  // Only call once when authentication completes
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      checkAndInstall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]); // Intentionally limited dependencies to prevent loop

  // Handlers
  const handlePlayClick = useCallback(async () => {
    if (!isAuthenticated || !user) {
      try {
        const deviceCode = await login();
        if (deviceCode) {
          setDeviceCodeInfo(deviceCode);
          await finishDeviceCodeAuth(deviceCode.device_code, deviceCode.interval);
          setDeviceCodeInfo(null);
          addToast('Authentication successful!', 'success');
        }
      } catch (err) {
        setDeviceCodeInfo(null);
        addToast(`Authentication failed: ${err}`, 'error');
      }
      return;
    }

    // LAUNCHER VERSION CHECK: Block launch if launcher itself is outdated
    try {
      console.log('[Play] Checking launcher version...');
      const { checkLauncherUpdate } = await import('../hooks/useTauriCommands');
      const launcherUpdate = await checkLauncherUpdate();

      console.log('[Play] Launcher update check:', launcherUpdate);

      // If update is available and mandatory, BLOCK launch
      if (launcherUpdate.available && launcherUpdate.mandatory) {
        console.error('[Play] ✗ Launcher update is MANDATORY! Current version outdated.');
        addToast(
          `Launcher update required! Version ${launcherUpdate.version} is available. Please restart to update.`,
          'error'
        );
        return; // BLOCK launch - launcher must be updated
      }

      // If update is available but not mandatory, warn but allow launch
      if (launcherUpdate.available) {
        console.warn('[Play] ⚠ Launcher update available (optional):', launcherUpdate.version);
        addToast(
          `Launcher update ${launcherUpdate.version} available (optional)`,
          'info'
        );
      } else {
        console.log('[Play] ✓ Launcher is up to date');
      }
    } catch (err) {
      console.error('[Play] Launcher version check failed:', err);
      // Don't block launch if check fails - server might not have launcher manifest yet
      console.warn('[Play] ⚠ Continuing without launcher version check');
    }

    // MODPACK VERSION CHECK: Simple caveman-style "do numbers match?" check before EVERY launch
    try {
      console.log('[Play] Checking modpack version...');
      const serverManifest = await checkUpdates();
      const myVersion = installedVersion;
      const serverVersion = serverManifest.version;

      console.log('[Play] Modpack version check:', { myVersion, serverVersion });

      // Simple number comparison - do they match?
      if (myVersion !== serverVersion) {
        console.log('[Play] Modpack version mismatch detected! Forcing update...');
        addToast(`Modpack update required: ${myVersion || 'none'} → ${serverVersion}`, 'info');

        // FORCE update - block launch until updated
        await performInstall({ blockUi: true });
        return;
      }

      console.log('[Play] ✓ Modpack versions match, proceeding with launch');
    } catch (err) {
      console.error('[Play] Modpack version check failed:', err);
      addToast(`Failed to verify modpack version: ${err}`, 'error');
      return; // Don't launch if we can't verify version
    }

    if (minecraftInstalled && versionId && user.session_id) {
      try {
        await launchGame({
          username: user.username,
          uuid: user.uuid,
          accessToken: user.session_id, // Backend will resolve session_id to token
          versionId: versionId
        });
      } catch (err) {
        // Error handled by hook state
      }
    }
  }, [
    isAuthenticated,
    user,
    login,
    finishDeviceCodeAuth,
    addToast,
    checkUpdates,
    installedVersion,
    performInstall,
    minecraftInstalled,
    versionId,
    launchGame
  ]);

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
      <ServerMOTD motd={status?.motd} />

      {/* Main Layout Container */}
      <div className="w-full relative flex justify-center px-4">
        {/* Content Card */}
        <div className="card max-w-2xl w-full space-y-2">

          {/* Server Status & Discord */}
          <div className="flex gap-3">
            <ServerStatus 
              status={status} 
              isLoading={!status} // Approximate loading state
            />
            <DiscordStatus 
              isConnected={discordConnected}
              isConnecting={discordConnecting}
              error={discordError}
              onReconnect={connectDiscord}
            />
          </div>

          {/* Background Errors */}
          {modpackState.backgroundErrors && modpackState.backgroundErrors.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-600 rounded p-3 mb-2">
              <div className="flex justify-between items-center">
                <p className="text-yellow-200 text-sm font-semibold" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
                  {modpackState.backgroundErrors.length} background operation(s) failed
                </p>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => performVerify({ silent: false })}
                    className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-2 py-1 rounded transition-colors"
                  >
                    Repair Now
                  </button>
                  <button 
                    onClick={clearBackgroundErrors}
                    className="text-xs text-yellow-400 hover:text-yellow-200 px-2 py-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Authentication Card */}
          <AuthenticationCard 
            isAuthenticated={isAuthenticated}
            isLoading={authLoading}
            user={user || undefined}
            minecraftInstalled={minecraftInstalled}
          />

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
                          ❄️ New Release!
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
                <PlayButton 
                  state={playButtonState}
                  onClick={handlePlayClick}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Player List */}
          <PlayerList status={status} trackerState={trackerState} />
        </div>

        {/* Cat Model - Left side - Lazy loaded */}
        <div className="absolute left-[calc(50%-730px)] top-[-80px]">
          <CatModelWithSuspense />
        </div>

        {/* 3D Skin Viewer - Right side - Only show when authenticated - Lazy loaded */}
        {isAuthenticated && user && (
          <div className="absolute left-[calc(50%+380px)] top-[-80px]">
            <SkinViewerWithSuspense
              username={user.username}
              uuid={user.uuid}
              skinUrl={user.skin_url}
            />
          </div>
        )}
      </div>

      {/* Modpack Status Card */}
      <ModpackStatus 
        installedVersion={installedVersion}
        latestManifest={latestManifest}
        minecraftInstalled={minecraftInstalled}
        versionId={versionId}
        isDownloading={isDownloading}
        isBlockedForInstall={isBlockedForInstall}
        ramAllocation={ramAllocation}
      />
    </div>
  );
}
