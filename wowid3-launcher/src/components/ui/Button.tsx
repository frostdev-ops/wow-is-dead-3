import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) => {
  const variantStyles = {
    primary: {
      backgroundColor: 'rgba(255, 215, 0, 0.9)',
      color: '#000',
      border: '2px solid rgba(255, 215, 0, 0.8)',
    },
    secondary: {
      backgroundColor: 'rgba(77, 130, 110, 0.65)',
      color: '#fff',
      border: '1px solid rgba(255, 255, 255, 0.3)',
    },
    danger: {
      backgroundColor: 'rgba(220, 38, 38, 0.8)',
      color: '#fff',
      border: '1px solid rgba(220, 38, 38, 0.9)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'rgba(255, 215, 0, 0.9)',
      border: '2px solid rgba(255, 215, 0, 0.8)',
    },
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={`font-bold transition-all ${sizeClasses[size]} disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80`}
      style={{
        ...variantStyles[variant],
        borderRadius: '0',
        fontFamily: "'Trebuchet MS', sans-serif",
        backdropFilter: 'blur(12px)',
      }}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? '...' : children}
    </button>
  );
};
