import { ProgressBar } from './ProgressBar';

export interface DownloadProgress {
  total: number;
  current: number;
  total_bytes: number;
  current_bytes: number;
  step?: string;
  message?: string;
}

export interface InstallProgressProps {
  progress: DownloadProgress;
  currentStep: string;
  totalSteps: number;
  speed?: number; // bytes/second
  eta?: number; // milliseconds
  className?: string;
}

export function InstallProgress({ progress, currentStep, totalSteps, speed, eta, className = '' }: InstallProgressProps) {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const formatTime = (ms: number) => {
    if (!ms || !isFinite(ms)) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || !isFinite(bytesPerSec)) return '';
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-sm font-medium text-gray-200">
        <span>{currentStep}</span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      
      <ProgressBar 
        value={percentage} 
        showLabel={false}
        height="h-2"
        className="mb-1"
      />
      
      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {progress.current} / {progress.total} files
        </span>
        <div className="flex gap-3">
          {speed !== undefined && <span>{formatSpeed(speed)}</span>}
          {eta !== undefined && <span>ETA: {formatTime(eta)}</span>}
        </div>
      </div>
    </div>
  );
}

