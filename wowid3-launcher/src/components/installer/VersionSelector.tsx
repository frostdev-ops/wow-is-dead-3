import { useMinecraftInstaller } from '../../hooks';
import { Card } from '../ui/Card';

export function VersionSelector() {
  const {
    selectedVersion,
    fabricEnabled,
    selectedFabricLoader,
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

      {/* Version Information (Read-Only) */}
      <div className="mb-4 p-4" style={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 215, 0, 0.5)',
        borderRadius: '0',
      }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            Minecraft Version:
          </span>
          <span className="text-base font-bold" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>
            {selectedVersion}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            Fabric Loader:
          </span>
          <span className="text-base font-bold" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>
            {fabricEnabled ? selectedFabricLoader : 'Disabled'}
          </span>
        </div>
        <p className="text-xs mt-3 text-center" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif", opacity: 0.7 }}>
          Versions are preset by modpack requirements
        </p>
      </div>

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
