interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
  showPercentage?: boolean;
}

export const ProgressBar = ({
  current,
  total,
  showLabel = true,
  showPercentage = true,
}: ProgressBarProps) => {
  const percentage = Math.min(100, Math.round((current / total) * 100));

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-2">
          <span className="text-sm text-slate-300" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>Downloading</span>
          {showPercentage && (
            <span className="text-sm font-semibold text-red-500">{percentage}%</span>
          )}
        </div>
      )}
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            background: 'repeating-linear-gradient(45deg, #dc2626 0px, #dc2626 10px, #ffffff 10px, #ffffff 20px)'
          }}
        />
      </div>
      {showLabel && (
        <div className="text-xs text-slate-400 mt-1">
          {Math.round(current / 1024 / 1024)} MB / {Math.round(total / 1024 / 1024)} MB
        </div>
      )}
    </div>
  );
};
