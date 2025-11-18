import { useState } from 'react';
import { useSettingsStore } from '../stores';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { useToast } from './ui/ToastContainer';
import { VersionSelector, InstallProgress } from './installer';

export default function SettingsScreen() {
  const { gameDirectory, ramAllocation, serverAddress, manifestUrl, keepLauncherOpen, setGameDirectory, setRamAllocation, setServerAddress, setManifestUrl, setKeepLauncherOpen } = useSettingsStore();
  const { addToast } = useToast();

  const [tempGameDir, setTempGameDir] = useState(gameDirectory);
  const [tempRam, setTempRam] = useState(ramAllocation);
  const [tempServerAddr, setTempServerAddr] = useState(serverAddress);
  const [tempManifestUrl, setTempManifestUrl] = useState(manifestUrl);
  const [tempKeepLauncherOpen, setTempKeepLauncherOpen] = useState(keepLauncherOpen);

  const handleSave = () => {
    setGameDirectory(tempGameDir);
    setRamAllocation(tempRam);
    setServerAddress(tempServerAddr);
    setManifestUrl(tempManifestUrl);
    setKeepLauncherOpen(tempKeepLauncherOpen);
    addToast('Settings saved successfully', 'success');
  };

  const handleReset = () => {
    setTempGameDir(gameDirectory);
    setTempRam(ramAllocation);
    setTempServerAddr(serverAddress);
    setTempManifestUrl(manifestUrl);
    setTempKeepLauncherOpen(keepLauncherOpen);
  };

  return (
    <div className="p-6 pt-24 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>Settings</h1>

      <div className="space-y-6">
        {/* Game Settings */}
        <Card>
          <h2 className="text-xl font-bold mb-4" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>Game Settings</h2>

          {/* Warning Box */}
          <div
            className="mb-4 p-3 text-center"
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.8)',
              borderRadius: '8px',
              maxWidth: '400px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <span
              className="text-sm"
              style={{
                color: '#fca5a5',
                fontFamily: "'Trebuchet MS', sans-serif",
              }}
            >
              ⚠ Default install location recommended
            </span>
          </div>

          <div className="space-y-4">
            <Input
              label="Game Directory"
              value={tempGameDir}
              onChange={(e) => setTempGameDir(e.target.value)}
              placeholder="/path/to/game"
              helperText="Where the game will be installed"
            />
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
                RAM Allocation: {tempRam}MB
              </label>
              <input
                type="range"
                min="2048"
                max="16384"
                step="512"
                value={tempRam}
                onChange={(e) => setTempRam(parseInt(e.target.value))}
                className="w-full"
                style={{
                  accentColor: '#FFD700',
                }}
              />
              <p className="text-xs mt-1" style={{ color: '#c6ebdaff' }}>
                Recommended: 4096-8192MB
              </p>
            </div>
          </div>
        </Card>

        {/* Server Settings */}
        <Card>
          <h2 className="text-xl font-bold mb-4" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>Server Settings</h2>
          <div className="space-y-4">
            <Input
              label="Server Address"
              value={tempServerAddr}
              onChange={(e) => setTempServerAddr(e.target.value)}
              placeholder="play.example.com:25565"
              helperText="Default server to connect to"
            />
          </div>
        </Card>

        {/* Modpack Settings */}
        <Card>
          <h2 className="text-xl font-bold mb-4" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>Modpack Settings</h2>
          <div className="space-y-4">
            <Input
              label="Manifest URL"
              value={tempManifestUrl}
              onChange={(e) => setTempManifestUrl(e.target.value)}
              placeholder="https://example.com/manifest.json"
              helperText="URL to the modpack manifest file"
            />
          </div>
        </Card>

        {/* Launcher Behavior */}
        <Card>
          <h2 className="text-xl font-bold mb-4" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>Launcher Behavior</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="keepLauncherOpen"
                checked={tempKeepLauncherOpen}
                onChange={(e) => setTempKeepLauncherOpen(e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer"
                style={{ accentColor: '#FFD700' }}
              />
              <label htmlFor="keepLauncherOpen" className="flex flex-col cursor-pointer">
                <span className="text-sm font-semibold" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
                  Keep launcher open during gameplay
                </span>
                <span className="text-xs mt-1" style={{ color: '#999' }}>
                  Shows a live log viewer with game controls instead of minimizing the launcher window
                </span>
              </label>
            </div>
          </div>
        </Card>

        {/* Minecraft Installation */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>
            Minecraft Installation
          </h2>
          <p className="text-sm" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            Manage your Minecraft installation. Select a version and optionally install with Fabric mod loader.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VersionSelector />
            <InstallProgress />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
