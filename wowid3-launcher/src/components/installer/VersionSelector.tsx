import { useMinecraftInstaller } from '../../hooks';
import { Card } from '../ui/Card';

export function VersionSelector() {
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
    error,
    clearError,
  } = useMinecraftInstaller();

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-4" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>
        Minecraft Version
      </h2>

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

      {/* Version Selector */}
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
          Minecraft Version
        </label>
        <select
          value={selectedVersion || ''}
          onChange={(e) => setSelectedVersion(e.target.value)}
          disabled={isLoadingVersions}
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
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id} ({version.version_type})
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Fabric Toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={fabricEnabled}
            onChange={(e) => setFabricEnabled(e.target.checked)}
            className="w-5 h-5"
            style={{
              accentColor: '#FFD700',
            }}
          />
          <span className="text-sm font-semibold" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            Install with Fabric Mod Loader
          </span>
        </label>
      </div>

      {/* Fabric Loader Selector */}
      {fabricEnabled && (
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            Fabric Loader Version
          </label>
          <select
            value={selectedFabricLoader || ''}
            onChange={(e) => setSelectedFabricLoader(e.target.value)}
            disabled={isLoadingFabric || fabricLoaders.length === 0}
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

      {/* Installation Status */}
      {selectedVersion && (
        <div className="mt-4 p-3" style={{
          backgroundColor: isInstalled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
          border: `1px solid ${isInstalled ? 'rgba(34, 197, 94, 0.8)' : 'rgba(234, 179, 8, 0.8)'}`,
          borderRadius: '0',
        }}>
          <span className="text-sm" style={{
            color: isInstalled ? '#86efac' : '#fde047',
            fontFamily: "'Trebuchet MS', sans-serif",
          }}>
            {isInstalled ? '✓ This version is installed and ready to play' : '⚠ This version needs to be installed'}
          </span>
        </div>
      )}
    </Card>
  );
}
