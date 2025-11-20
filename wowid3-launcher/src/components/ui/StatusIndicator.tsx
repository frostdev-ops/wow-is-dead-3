interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'loading' | 'error';
  label: string;
  details?: string;
  className?: string;
}

export function StatusIndicator({ status, label, details, className = '' }: StatusIndicatorProps) {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    loading: 'bg-blue-500',
    error: 'bg-yellow-500',
  };

  const pulseClass = status === 'online' || status === 'loading' ? 'animate-pulse' : '';

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${statusColors[status]} ${pulseClass}`} />
      <div className="flex flex-col">
        <p className="text-sm font-medium leading-none">{label}</p>
        {details && <p className="text-xs text-gray-400 mt-0.5">{details}</p>}
      </div>
    </div>
  );
}

