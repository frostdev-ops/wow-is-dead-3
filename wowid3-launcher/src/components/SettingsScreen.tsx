import { useState } from 'react';
import { useSettingsStore } from '../stores';
import { useTheme, getAllThemes } from '../hooks/useTheme';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { useToast } from './ui/ToastContainer';

export default function SettingsScreen() {
  const { gameDirectory, ramAllocation, serverAddress, manifestUrl, theme, setGameDirectory, setRamAllocation, setServerAddress, setManifestUrl, setTheme } = useSettingsStore();
  const { addToast } = useToast();
  const { applyTheme } = useTheme();
  const availableThemes = getAllThemes();

  const [tempGameDir, setTempGameDir] = useState(gameDirectory);
  const [tempRam, setTempRam] = useState(ramAllocation);
  const [tempServerAddr, setTempServerAddr] = useState(serverAddress);
  const [tempManifestUrl, setTempManifestUrl] = useState(manifestUrl);
  const [tempTheme, setTempTheme] = useState<'christmas' | 'dark' | 'light'>(theme);

  const handleSave = () => {
    setGameDirectory(tempGameDir);
    setRamAllocation(tempRam);
    setServerAddress(tempServerAddr);
    setManifestUrl(tempManifestUrl);
    if (tempTheme !== theme) {
      setTheme(tempTheme);
      applyTheme(tempTheme);
    }
    addToast('Settings saved successfully', 'success');
  };

  const handleReset = () => {
    setTempGameDir(gameDirectory);
    setTempRam(ramAllocation);
    setTempServerAddr(serverAddress);
    setTempManifestUrl(manifestUrl);
    setTempTheme(theme);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Game Settings */}
        <Card>
          <h2 className="text-xl font-bold text-white mb-4">Game Settings</h2>
          <div className="space-y-4">
            <Input
              label="Game Directory"
              value={tempGameDir}
              onChange={(e) => setTempGameDir(e.target.value)}
              placeholder="/path/to/game"
              helperText="Where the game will be installed"
            />
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-2">
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
              />
              <p className="text-xs text-slate-400 mt-1">
                Recommended: 4096-8192MB
              </p>
            </div>
          </div>
        </Card>

        {/* Server Settings */}
        <Card>
          <h2 className="text-xl font-bold text-white mb-4">Server Settings</h2>
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
          <h2 className="text-xl font-bold text-white mb-4">Modpack Settings</h2>
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

        {/* Theme Settings */}
        <Card>
          <h2 className="text-xl font-bold text-white mb-4">Theme Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-3">
                Select Theme
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {availableThemes.map((themeOption) => (
                  <button
                    key={themeOption.id}
                    onClick={() => setTempTheme(themeOption.id as 'christmas' | 'dark' | 'light')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      tempTheme === themeOption.id
                        ? 'border-red-500 bg-slate-700'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: themeOption.colors.primary }}
                      />
                      <span className="text-white font-semibold">{themeOption.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

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
