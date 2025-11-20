import { useState, useEffect, useRef } from 'react';
import { fontFamilies, christmasSemanticColors } from '../../themes/tokens';

interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
  showPercentage?: boolean;
  showSpeed?: boolean;
  showETA?: boolean;
  className?: string;
  label?: string;
  progressColor?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'adaptive';
}

const progressColorMap = {
  primary: christmasSemanticColors.primary,
  success: christmasSemanticColors.success,
  warning: christmasSemanticColors.warning,
  error: christmasSemanticColors.error,
  info: christmasSemanticColors.info,
};

export const ProgressBar = ({
  current,
  total,
  showLabel = true,
  showPercentage = true,
  showSpeed = true,
  showETA = true,
  className = '',
  label = 'Downloading',
  progressColor = 'adaptive',
}: ProgressBarProps) => {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [eta, setEta] = useState<string>('Calculating...');
  const lastCurrentRef = useRef(current);
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    // Calculate download speed and ETA
    const now = Date.now();
    const timeDiff = (now - lastTimeRef.current) / 1000; // seconds
    const bytesDiff = current - lastCurrentRef.current;

    if (timeDiff > 0 && bytesDiff > 0) {
      const speedBytesPerSecond = bytesDiff / timeDiff;
      setDownloadSpeed(speedBytesPerSecond);

      // Calculate ETA
      const bytesRemaining = total - current;
      const secondsRemaining = bytesRemaining / speedBytesPerSecond;

      if (secondsRemaining < 60) {
        setEta(`${Math.ceil(secondsRemaining)}s`);
      } else if (secondsRemaining < 3600) {
        const minutes = Math.floor(secondsRemaining / 60);
        const seconds = Math.ceil(secondsRemaining % 60);
        setEta(`${minutes}m ${seconds}s`);
      } else {
        const hours = Math.floor(secondsRemaining / 3600);
        const minutes = Math.floor((secondsRemaining % 3600) / 60);
        setEta(`${hours}h ${minutes}m`);
      }
    }

    lastCurrentRef.current = current;
    lastTimeRef.current = now;
  }, [current, total]);

  const formatSpeed = (bytesPerSecond: number): string => {
    const mbPerSecond = bytesPerSecond / 1024 / 1024;
    if (mbPerSecond < 1) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    }
    return `${mbPerSecond.toFixed(2)} MB/s`;
  };

  const getProgressColor = () => {
    if (progressColor === 'adaptive') {
      if (percentage < 33) return christmasSemanticColors.error;
      if (percentage < 66) return christmasSemanticColors.warning;
      return christmasSemanticColors.success;
    }
    return progressColorMap[progressColor];
  };

  return (
    <div className={`w-full ${className}`} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium" style={{ color: christmasSemanticColors.textSecondary, fontFamily: fontFamilies.body }}>
            {label}
          </span>
          {showPercentage && (
            <span className="text-sm font-semibold" style={{ color: getProgressColor() }}>
              {percentage}%
            </span>
          )}
        </div>
      )}
      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border-2 border-slate-600">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            background: `repeating-linear-gradient(45deg, ${getProgressColor()} 0px, ${getProgressColor()} 10px, rgba(255, 255, 255, 0.8) 10px, rgba(255, 255, 255, 0.8) 20px)`,
          }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between items-center mt-2 text-xs" style={{ color: christmasSemanticColors.textSecondary, fontFamily: fontFamilies.body }}>
          <div className="flex gap-4">
            <span>
              {(current / 1024 / 1024).toFixed(1)} MB / {(total / 1024 / 1024).toFixed(1)} MB
            </span>
            {showSpeed && downloadSpeed > 0 && (
              <span style={{ color: christmasSemanticColors.info }}>
                {formatSpeed(downloadSpeed)}
              </span>
            )}
          </div>
          {showETA && downloadSpeed > 0 && current < total && (
            <span className="text-slate-300">
              ETA: {eta}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
