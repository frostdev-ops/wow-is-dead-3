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
import ModpackUpdateDialog from './ModpackUpdateDialog';
import { SkinViewerWithSuspense, CatModelWithSuspense } from './LazyComponents';
import { MinecraftSetup } from './MinecraftSetup';
import { AuthenticationCard } from './features/AuthenticationCard';
import { ModpackStatus } from './features/ModpackStatus';
import { ServerStatus, ServerMOTD } from './features/ServerStatus';
import { DiscordStatus } from './features/DiscordStatus';
import { PlayButton, usePlayButtonState } from './features/PlayButton';
import { useGameLauncher } from '../hooks/useGameLauncher';
import { useModpackLifecycle } from '../hooks/useModpackLifecycle';
import { useUpdateStore } from '../stores/updateStore';
import type { DeviceCodeInfo } from '../hooks/useTauriCommands';

export default function LauncherHome() {
  // Refs for tracking state updates
  const justInstalledRef = useRef(false);

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

  // Update Store
  const {
    launcherUpdate,
    modpackUpdate,
    setLauncherUpdate,
    setModpackUpdate,
    setShowLauncherUpdateModal
  } = useUpdateStore();

  // Local State
  const [showChangelog, setShowChangelog] = useState(false);
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const [isCheckingLauncherUpdates, setIsCheckingLauncherUpdates] = useState(false);
  const [isCheckingModpackUpdates, setIsCheckingModpackUpdates] = useState(false);
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
  const isCheckingUpdates = isCheckingLauncherUpdates || isCheckingModpackUpdates;

  const playButtonState = useMemo(() => usePlayButtonState({
    authLoading,
    isLaunching,
    isPlaying,
    isBlockedForInstall,
    isDownloading,
    isAuthenticated,
    updateAvailable,
    isCheckingUpdates,
    launcherUpdateRequired: launcherUpdate?.available === true,
    modpackUpdateRequired: modpackUpdate?.available === true
  }), [
    authLoading,
    isLaunching,
    isPlaying,
    isBlockedForInstall,
    isDownloading,
    isAuthenticated,
    updateAvailable,
    isCheckingUpdates,
    launcherUpdate,
    modpackUpdate
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

  // 4. Check Launcher Updates (after authentication)
  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }

    const checkLauncherUpdates = async () => {
      try {
        setIsCheckingLauncherUpdates(true);
        const { checkLauncherUpdate } = await import('../hooks/useTauriCommands');
        const updateInfo = await checkLauncherUpdate();

        if (updateInfo.available) {
          setLauncherUpdate(updateInfo);
        } else {
          setLauncherUpdate(null);
        }
      } catch (err) {
        console.error('[LauncherHome] Failed to check launcher updates:', err);
        // Don't block if check fails
        setLauncherUpdate(null);
      } finally {
        setIsCheckingLauncherUpdates(false);
      }
    };

    checkLauncherUpdates();
  }, [isAuthenticated, authLoading, setLauncherUpdate]);

  // 5. Check Modpack Updates (after authentication)
  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }

    // Skip check immediately after install to prevent race condition
    if (justInstalledRef.current) {
      justInstalledRef.current = false;
      return;
    }

    const checkModpackUpdates = async () => {
      try {
        setIsCheckingModpackUpdates(true);
        const serverManifest = await checkUpdates();
        const myVersion = installedVersion;
        const serverVersion = serverManifest.version;

        if (myVersion !== serverVersion) {
          setModpackUpdate({
            available: true,
            currentVersion: myVersion || 'Not Installed',
            newVersion: serverVersion,
            changelog: serverManifest.changelog
          });
        } else {
          setModpackUpdate(null);
        }
      } catch (err) {
        console.error('[LauncherHome] Failed to check modpack updates:', err);
        // Don't block if check fails
        setModpackUpdate(null);
      } finally {
        setIsCheckingModpackUpdates(false);
      }
    };

    checkModpackUpdates();
  }, [isAuthenticated, authLoading, installedVersion, checkUpdates, setModpackUpdate]);

  // 6. Modpack Error Toast
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
    // Handle authentication
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

    // Check for launcher update (modal will be shown automatically by update store)
    if (launcherUpdate?.available) {
      // Modal is already shown via update store, just ensure it's visible
      setShowLauncherUpdateModal(true);
      return;
    }

    // Check for modpack update (dialog will be shown automatically)
    if (modpackUpdate?.available) {
      // Dialog is already shown via update store state
      // User must click "Update Now" in the dialog
      return;
    }

    // All checks passed, launch the game
    if (minecraftInstalled && versionId && user.session_id) {
      try {
        await launchGame({
          username: user.username,
          uuid: user.uuid,
          accessToken: user.session_id,
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
    launcherUpdate,
    modpackUpdate,
    setShowLauncherUpdateModal,
    minecraftInstalled,
    versionId,
    launchGame
  ]);

  // Handler for modpack update confirmation
  const handleModpackUpdateConfirm = useCallback(async () => {
    try {
      await performInstall({ blockUi: true });
      // Mark that we just installed to prevent the update check effect from re-running
      justInstalledRef.current = true;
      // After successful update, clear the modpack update state
      setModpackUpdate(null);
      addToast('Modpack updated successfully!', 'success');
    } catch (err) {
      addToast(`Failed to update modpack: ${err}`, 'error');
    }
  }, [performInstall, setModpackUpdate, addToast]);

  // Handler for modpack update cancellation
  const handleModpackUpdateCancel = useCallback(() => {
    // Just close the dialog, keep the update state so button shows "Modpack Update Available"
    addToast('Modpack update cancelled. You must update to play.', 'warning');
  }, [addToast]);

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

                {/* Modpack Update Dialog */}
                <ModpackUpdateDialog
                  onConfirm={handleModpackUpdateConfirm}
                  onCancel={handleModpackUpdateCancel}
                />

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
