import { useMinecraftInstaller } from '../hooks';
import { Card } from './ui/Card';
import { INSTALL_STEP_LABELS } from '../types/minecraft';

export function MinecraftSetup() {
  const {
    versions,
    selectedVersion,
    setSelectedVersion,
    isLoadingVersions,
    fabricEnabled,
    setFabricEnabled,
    fabricLoaders,
    selectedFabricLoader,
    setSelectedFabricLoader,
    isLoadingFabric,
    isInstalled,
    isInstalling,
    installProgress,
    install,
    error,
    clearError,
  } = useMinecraftInstaller();

  const handleInstall = async () => {
    await install();
  };

  // Calculate progress percentage
  const progressPercentage =
    installProgress && installProgress.total > 0
      ? Math.round((installProgress.current / installProgress.total) * 100)
      : 0;

  // Format bytes to MB
  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <Card>
        <div className="text-center mb-6">
          <h2
            className="text-3xl font-bold mb-2"
            style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}
          >
            Welcome to WOWID3 Launcher
          </h2>
          <p
            className="text-lg"
            style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}
          >
            Get started by installing Minecraft
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div
            className="mb-4 p-3"
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.8)',
              borderRadius: '0',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-red-300" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
                {error}
              </span>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-300"
                style={{ fontFamily: "'Trebuchet MS', sans-serif" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Version Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Minecraft Version */}
          <div>
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}
            >
              Minecraft Version
            </label>
            <select
              value={selectedVersion || ''}
              onChange={(e) => setSelectedVersion(e.target.value)}
              disabled={isLoadingVersions || isInstalling}
              className="w-full px-4 py-3 text-white"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '0',
                fontFamily: "'Trebuchet MS', sans-serif",
              }}
            >
              {isLoadingVersions ? (
                <option>Loading versions...</option>
              ) : (
                <>
                  <option value="" disabled>
                    Select a version
                  </option>
                  {versions.slice(0, 20).map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.id} ({version.version_type})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Fabric Loader (conditional) */}
          {fabricEnabled && (
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}
              >
                Fabric Loader Version
              </label>
              <select
                value={selectedFabricLoader || ''}
                onChange={(e) => setSelectedFabricLoader(e.target.value)}
                disabled={isLoadingFabric || fabricLoaders.length === 0 || isInstalling}
                className="w-full px-4 py-3 text-white"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '0',
                  fontFamily: "'Trebuchet MS', sans-serif",
                }}
              >
                {isLoadingFabric ? (
                  <option>Loading Fabric loaders...</option>
                ) : fabricLoaders.length === 0 ? (
                  <option>No Fabric loaders available</option>
                ) : (
                  <>
                    <option value="" disabled>
                      Select a loader version
                    </option>
                    {fabricLoaders.map((loader) => (
                      <option key={loader.version} value={loader.version}>
                        {loader.version} {loader.stable ? '(Stable)' : '(Beta)'}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        {/* Fabric Toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fabricEnabled}
              onChange={(e) => setFabricEnabled(e.target.checked)}
              disabled={isInstalling}
              className="w-5 h-5"
              style={{
                accentColor: '#FFD700',
              }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}
            >
              Install with Fabric Mod Loader
            </span>
          </label>
        </div>

        {/* Installation Status / Progress */}
        {!isInstalling && selectedVersion && (
          <div
            className="mb-6 p-3"
            style={{
              backgroundColor: isInstalled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              border: `1px solid ${isInstalled ? 'rgba(34, 197, 94, 0.8)' : 'rgba(234, 179, 8, 0.8)'}`,
              borderRadius: '0',
            }}
          >
            <span
              className="text-sm"
              style={{
                color: isInstalled ? '#86efac' : '#fde047',
                fontFamily: "'Trebuchet MS', sans-serif",
              }}
            >
              {isInstalled
                ? '✓ This version is installed and ready to play'
                : '⚠ This version needs to be installed'}
            </span>
          </div>
        )}

        {/* Progress Bar (during installation) */}
        {isInstalling && installProgress && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span
                className="text-sm font-semibold"
                style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}
              >
                {INSTALL_STEP_LABELS[installProgress.step as keyof typeof INSTALL_STEP_LABELS] ||
                  installProgress.message}
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}
              >
                {progressPercentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div
              className="w-full h-4 overflow-hidden mb-2"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '0',
              }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: '#FFD700',
                }}
              />
            </div>

            {/* Progress Details */}
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
                {installProgress.current} / {installProgress.total} files
              </span>
              <span style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
                {formatMB(installProgress.current_bytes)} MB / {formatMB(installProgress.total_bytes)} MB
              </span>
            </div>

            {/* Special note for assets */}
            {installProgress.step === 'assets' && (
              <p
                className="text-xs mt-2 text-center"
                style={{ color: '#fde047', fontFamily: "'Trebuchet MS', sans-serif" }}
              >
                ⏳ Downloading assets can take 2-5 minutes (4000+ files)
              </p>
            )}
          </div>
        )}

        {/* Install Button */}
        {!isInstalling && !isInstalled && selectedVersion && (
          <button
            onClick={handleInstall}
            disabled={!selectedVersion}
            className="w-full py-4 text-xl font-bold transition-all"
            style={{
              backgroundColor: selectedVersion ? 'rgba(255, 215, 0, 0.9)' : 'rgba(128, 128, 128, 0.5)',
              color: selectedVersion ? '#000' : '#666',
              border: selectedVersion ? '2px solid rgba(255, 215, 0, 1)' : '2px solid rgba(128, 128, 128, 0.8)',
              borderRadius: '0',
              fontFamily: "'Trebuchet MS', sans-serif",
              cursor: selectedVersion ? 'pointer' : 'not-allowed',
            }}
          >
            Install Minecraft
          </button>
        )}

        {/* Advanced Options Link */}
        <div className="mt-4 text-center">
          <p className="text-sm" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            Need to configure RAM or Java settings?{' '}
            <span className="text-yellow-400 hover:text-yellow-300 cursor-pointer">
              Go to Settings for advanced options
            </span>
          </p>
        </div>
      </Card>
    </div>
  );
}
