import { FC } from 'react';

export interface ModpackStatusProps {
  installedVersion?: string | null;
  latestManifest?: {
    version: string;
    minecraft_version: string;
    files: Array<{ path?: string }>;
  } | null;
  minecraftInstalled: boolean;
  versionId?: string | null;
  isDownloading: boolean;
  isBlockedForInstall: boolean;
  ramAllocation: number;
}

export const ModpackStatus: FC<ModpackStatusProps> = ({
  installedVersion,
  latestManifest,
  minecraftInstalled,
  versionId,
  isDownloading,
  isBlockedForInstall,
  ramAllocation,
}) => {
  const getModCount = () => {
    // Downloading/Installing - show loading state
    if (isDownloading || isBlockedForInstall) return '...';

    // Have installed version but no manifest (offline mode)
    if (installedVersion && !latestManifest) return '?';

    // Have both - show count only if versions match
    if (installedVersion && latestManifest) {
      if (installedVersion === latestManifest.version) {
        return (
          latestManifest.files.filter((f: any) => f.path?.endsWith('.jar')).length || 0
        );
      }
      // Version mismatch - update available but not installed yet
      return 0;
    }

    // Not installed
    return 0;
  };

  const getMinecraftVersion = () => {
    // Downloading/Installing - show loading state
    if (isDownloading || isBlockedForInstall) return '...';

    // Have installed version but no manifest (offline mode) - try to show something
    if (installedVersion && !latestManifest) return '?';

    // Have both and versions match - show MC version
    if (installedVersion && latestManifest && installedVersion === latestManifest.version) {
      return latestManifest.minecraft_version;
    }

    // Not installed or version mismatch
    return 'N/A';
  };

  const borderColor = installedVersion && minecraftInstalled ? '#16a34a' : '#dc2626';
  const statusColor = installedVersion ? '#16a34a' : '#dc2626';
  const minecraftColor = minecraftInstalled ? '#16a34a' : '#dc2626';

  return (
    <div
      className="max-w-2xl w-full mt-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        borderRadius: '0',
        padding: '1.5rem',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      }}
    >
      {/* Version Info */}
      <div
        className="flex justify-between text-sm pb-4 opacity-100"
        style={{
          fontFamily: "'Trebuchet MS', sans-serif",
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div>
          <span className="text-white">Modpack: </span>
          <span className="ml-2" style={{ color: statusColor }}>
            {installedVersion || 'Not installed'}
          </span>
        </div>
        <div>
          <span className="text-white">Minecraft: </span>
          <span className="ml-2" style={{ color: minecraftColor }}>
            {minecraftInstalled ? versionId || 'Installed' : 'Not installed'}
          </span>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: statusColor }}>
            {getModCount()}
          </p>
          <p className="text-xs text-gray-400">Mods Installed</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: statusColor }}>
            {getMinecraftVersion()}
          </p>
          <p className="text-xs text-gray-400">MC Version</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: statusColor }}>
            {Math.round(ramAllocation / 1024)}GB
          </p>
          <p className="text-xs text-gray-400">Allocated RAM</p>
        </div>
      </div>
    </div>
  );
};