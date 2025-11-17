import { useState, useEffect } from 'react';
import { DeviceCodeInfo } from '../hooks/useTauriCommands';
import { openUrl } from '@tauri-apps/plugin-opener';

interface DeviceCodeModalProps {
  deviceCodeInfo: DeviceCodeInfo;
  onCancel: () => void;
}

export default function DeviceCodeModal({ deviceCodeInfo, onCancel }: DeviceCodeModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(deviceCodeInfo.expires_in);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onCancel(); // Auto-cancel when expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onCancel]);

  const handleOpenBrowser = async () => {
    try {
      await openUrl(deviceCodeInfo.verification_uri);
    } catch (err) {
      console.error('Failed to open browser:', err);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(deviceCodeInfo.user_code);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 border-2 border-blue-500 rounded-lg p-8 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">Microsoft Authentication</h2>

        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <p className="text-gray-300 mb-4">
            To sign in, visit the following URL in your browser:
          </p>

          <div className="bg-gray-950 rounded p-3 mb-4">
            <code className="text-blue-400 text-sm break-all">{deviceCodeInfo.verification_uri}</code>
          </div>

          <button
            onClick={handleOpenBrowser}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded mb-4 transition-colors"
          >
            Open in Browser
          </button>

          <p className="text-gray-300 mb-2">
            Then enter this code:
          </p>

          <div className="bg-gray-950 rounded p-4 mb-4">
            <code className="text-green-400 text-2xl font-bold tracking-wider">{deviceCodeInfo.user_code}</code>
          </div>

          <button
            onClick={handleCopyCode}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Copy Code
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-gray-400 text-sm">
            Expires in: <span className="font-mono text-yellow-400">{formatTime(secondsRemaining)}</span>
          </div>
          <button
            onClick={onCancel}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-gray-500 text-sm">Waiting for you to complete authentication...</p>
          <div className="flex justify-center mt-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
