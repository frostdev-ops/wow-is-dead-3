import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

export const Toast = ({
  id,
  message,
  type,
  duration = 5000,
  onClose,
}: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const bgColors = {
    success: 'bg-green-900 border-green-700',
    error: 'bg-red-900 border-red-700',
    info: 'bg-blue-900 border-blue-700',
    warning: 'bg-yellow-900 border-yellow-700',
  };

  const textColors = {
    success: 'text-green-200',
    error: 'text-red-200',
    info: 'text-blue-200',
    warning: 'text-yellow-200',
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  return (
    <div
      className={`animate-slide-in flex items-center gap-3 px-4 py-3 rounded border ${bgColors[type]} ${textColors[type]}`}
    >
      <span className="font-bold">{icons[type]}</span>
      <span>{message}</span>
      <button
        onClick={() => onClose(id)}
        className="ml-auto text-lg leading-none hover:opacity-70"
      >
        ×
      </button>
    </div>
  );
};
