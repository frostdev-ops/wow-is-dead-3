import { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'error' | 'info';
}

/**
 * EmptyState component for displaying helpful messages when no data is available
 * Examples: No mods installed, server offline, empty player list
 */
export const EmptyState = ({
  icon,
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) => {
  const getIconColor = () => {
    switch (variant) {
      case 'error':
        return '#ef4444';
      case 'info':
        return '#3b82f6';
      default:
        return '#94a3b8';
    }
  };

  const defaultIcon = (
    <svg
      className="w-16 h-16"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      style={{ color: getIconColor() }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );

  return (
    <div
      className="flex flex-col items-center justify-center text-center p-12"
      role="status"
      aria-label={title}
    >
      <div className="mb-4" aria-hidden="true">
        {icon || defaultIcon}
      </div>
      <h3
        className="text-xl font-semibold mb-2"
        style={{ color: '#f8fafc', fontFamily: "'Trebuchet MS', sans-serif" }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm mb-6 max-w-md"
          style={{ color: '#cbd5e1', fontFamily: "'Trebuchet MS', sans-serif" }}
        >
          {description}
        </p>
      )}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};
