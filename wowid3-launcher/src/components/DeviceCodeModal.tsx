import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2147483647, backgroundColor: 'rgba(0, 0, 0, 0.95)' }}>
      <div className="p-8 max-w-md w-full" style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '2px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '0',
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
      }}>
        <h2 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>Microsoft Authentication</h2>

        <div className="p-6 mb-6" style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '0',
        }}>
          <p className="text-gray-300 mb-4" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
            To sign in, visit the following URL in your browser:
          </p>

          <div className="p-3 mb-4" style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '0',
          }}>
            <code className="text-sm break-all" style={{ color: '#3b82f6', fontFamily: "'Trebuchet MS', sans-serif" }}>{deviceCodeInfo.verification_uri}</code>
          </div>

          <button
            onClick={handleOpenBrowser}
            className="w-full font-semibold py-2 px-4 mb-4 transition-colors"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.3)',
              border: '2px solid rgba(59, 130, 246, 0.6)',
              color: '#3b82f6',
              borderRadius: '0',
              fontFamily: "'Trebuchet MS', sans-serif",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.4)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'}
          >
            Open in Browser
          </button>

          <p className="text-gray-300 mb-2" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
            Then enter this code:
          </p>

          <div className="p-4 mb-4" style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '0',
          }}>
            <code className="text-2xl font-bold tracking-wider" style={{ color: '#22c55e', fontFamily: "'Trebuchet MS', sans-serif" }}>{deviceCodeInfo.user_code}</code>
          </div>

          <button
            onClick={handleCopyCode}
            className="w-full font-semibold py-2 px-4 transition-colors"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.3)',
              border: '2px solid rgba(34, 197, 94, 0.6)',
              color: '#22c55e',
              borderRadius: '0',
              fontFamily: "'Trebuchet MS', sans-serif",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.4)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.3)'}
          >
            Copy Code
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-gray-400 text-sm" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
            Expires in: <span className="font-mono" style={{ color: '#FFD700' }}>{formatTime(secondsRemaining)}</span>
          </div>
          <button
            onClick={onCancel}
            className="font-semibold py-2 px-4 transition-colors"
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.3)',
              border: '2px solid rgba(220, 38, 38, 0.6)',
              color: '#ef4444',
              borderRadius: '0',
              fontFamily: "'Trebuchet MS', sans-serif",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.4)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.3)'}
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-gray-400 text-sm" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>Waiting for you to complete authentication...</p>
          <div className="flex justify-center mt-2">
            <div className="animate-spin rounded-full h-6 w-6" style={{ borderBottom: '2px solid #FFD700' }}></div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
