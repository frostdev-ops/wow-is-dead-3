import { FC, ChangeEvent, useState, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useAudio } from '../hooks';
import { Input } from './ui/Input';
// Logger import for future use
// import { logger, LogCategory } from '../utils/logger';

// Validation helpers
const validateGameDirectory = (path: string): { valid: boolean; message?: string } => {
  if (!path.trim()) return { valid: false, message: 'Game directory is required' };
  // Basic path validation (platform agnostic-ish)
  if (path.includes('..')) return { valid: false, message: 'Relative paths not allowed' };
  return { valid: true };
};

const validateManifestUrl = (url: string): { valid: boolean; message?: string } => {
  if (!url.trim()) return { valid: false, message: 'Manifest URL is required' };
  try {
    new URL(url);
    return { valid: true };
  } catch (e) {
    return { valid: false, message: 'Invalid URL format' };
  }
};

const validateRamAllocationMB = (ram: number): { valid: boolean; message?: string } => {
  if (ram < 1024) return { valid: false, message: 'Minimum 1GB (1024MB) required' };
  if (ram > 32768) return { valid: false, message: 'Maximum 32GB (32768MB)' };
  return { valid: true };
};

const getRecommendedRam = () => 4096;

export const SettingsScreen: FC = () => {
  const {
    gameDirectory,
    setGameDirectory,
    manifestUrl,
    setManifestUrl,
    ramAllocation,
    setRamAllocation,
    keepLauncherOpen,
    setKeepLauncherOpen,
  } = useSettingsStore();

  const { volume, setVolume } = useAudio();

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleGamePathChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value;
    const result = validateGameDirectory(newPath);
    
    setErrors(prev => ({
      ...prev,
      gamePath: result.message || ''
    }));
    
    if (result.valid) {
      setGameDirectory(newPath);
    }
  }, [setGameDirectory]);

  const handleManifestUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    const result = validateManifestUrl(newUrl);
    
    setErrors(prev => ({
      ...prev,
      manifestUrl: result.message || ''
    }));
    
    if (result.valid) {
      setManifestUrl(newUrl);
    }
  }, [setManifestUrl]);

  const handleRamChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newRam = Number(e.target.value);
    const result = validateRamAllocationMB(newRam);
    
    setErrors(prev => ({
      ...prev,
      ram: result.message || ''
    }));
    
    if (result.valid) {
      setRamAllocation(newRam);
    }
  }, [setRamAllocation]);

  const handleKeepLauncherOpenChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setKeepLauncherOpen(e.target.checked);
  }, [setKeepLauncherOpen]);

  const handleVolumeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  }, [setVolume]);

  return (
    <div className="max-w-2xl mx-auto w-full pt-8 px-4 pb-20">
      <h1 className="text-2xl font-bold mb-8 text-white" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
        Launcher Settings
      </h1>

      <div className="space-y-6 bg-black bg-opacity-40 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-10">
        
        <Input
          label="Game Directory"
          value={gameDirectory}
          onChange={handleGamePathChange}
          status={errors.gamePath ? 'error' : 'default'}
          error={errors.gamePath}
          helperText="Path where Minecraft files will be stored"
        />

        <Input
          label="Manifest URL"
          value={manifestUrl}
          onChange={handleManifestUrlChange}
          status={errors.manifestUrl ? 'error' : 'default'}
          error={errors.manifestUrl}
          helperText="URL to the modpack manifest JSON file"
        />

        <Input
          label="RAM Allocation (MB)"
          type="number"
          value={ramAllocation}
          onChange={handleRamChange}
          status={errors.ram ? 'error' : 'default'}
          error={errors.ram}
          helperText={`Recommended: ${getRecommendedRam()}MB. Allocated to Minecraft Java process.`}
        />

        <div className="space-y-4 pt-2">
          <div>
            <label htmlFor="volume" className="block text-sm font-medium text-gray-200 mb-2">
              Music Volume: {Math.round(volume * 100)}%
            </label>
            <input
              id="volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #374151 ${volume * 100}%, #374151 100%)`
              }}
            />
            <p className="text-xs text-gray-400 mt-1">Adjust background music volume</p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              id="keepLauncherOpen"
              type="checkbox"
              checked={keepLauncherOpen}
              onChange={handleKeepLauncherOpenChange}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600"
            />
            <label
              htmlFor="keepLauncherOpen"
              className="text-sm font-medium text-gray-200 cursor-pointer"
            >
              Keep launcher open while game is running
            </label>
          </div>
        </div>

      </div>
      
      <div className="mt-8 text-center text-xs text-gray-500">
        <p>WOWID3 Launcher v{import.meta.env.PACKAGE_VERSION || '0.1.0'}</p>
      </div>
    </div>
  );
};
