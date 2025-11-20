import { useEffect } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: string) => void;
  action?: ToastAction;
}

export const Toast = ({
  id,
  message,
  type,
  duration = 5000,
  onClose,
  action,
}: ToastProps) => {
  const { prefersReducedMotion } = useAccessibility();

  useEffect(() => {
    if (duration === 0) return; // Persistent toast
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

  const getAriaLive = () => {
    return type === 'error' ? 'assertive' : 'polite';
  };

  return (
    <div
      className={`${prefersReducedMotion ? '' : 'animate-slide-in'} flex items-center gap-3 px-4 py-3 rounded border ${bgColors[type]} ${textColors[type]}`}
      role="alert"
      aria-live={getAriaLive()}
      aria-atomic="true"
    >
      <span className="font-bold text-lg" aria-hidden="true">
        {icons[type]}
      </span>
      <span className="flex-1">{message}</span>
      {action && (
        <button
          onClick={() => {
            action.onClick();
            onClose(id);
          }}
          className="px-3 py-1 text-sm font-semibold rounded hover:bg-white hover:bg-opacity-20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label={action.label}
        >
          {action.label}
        </button>
      )}
      <button
        onClick={() => onClose(id)}
        className="ml-2 text-xl leading-none hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
};
