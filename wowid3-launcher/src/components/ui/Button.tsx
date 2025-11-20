import { ButtonHTMLAttributes, ReactNode } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';
import { fontFamilies } from '../../themes/tokens';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  isLoading = false,
  disabled,
  ariaLabel,
  ariaDescribedBy,
  onClick,
  ...props
}: ButtonProps) => {
  const { createKeyboardHandler } = useAccessibility();

  const variantClasses = {
    primary: 'bg-[rgba(255,215,0,0.9)] text-black border-2 border-[rgba(255,215,0,0.8)] hover:bg-[rgba(255,215,0,1)] hover:shadow-lg hover:shadow-[rgba(255,215,0,0.3)] active:scale-95',
    secondary: 'bg-[rgba(77,130,110,0.65)] text-white border border-[rgba(255,255,255,0.3)] hover:bg-[rgba(77,130,110,0.8)] active:scale-95',
    danger: 'bg-[rgba(220,38,38,0.8)] text-white border border-[rgba(220,38,38,0.9)] hover:bg-[rgba(220,38,38,0.9)] hover:shadow-lg hover:shadow-[rgba(220,38,38,0.3)] active:scale-95',
    outline: 'bg-transparent text-[rgba(255,215,0,0.9)] border-2 border-[rgba(255,215,0,0.8)] hover:bg-[rgba(255,215,0,0.1)] active:scale-95',
    ghost: 'bg-transparent text-white border-none hover:bg-[rgba(255,255,255,0.1)] active:bg-[rgba(255,255,255,0.15)] active:scale-95',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick && !disabled && !isLoading) {
      onClick(e);
    }
  };

  return (
    <button
      className={`
        font-bold
        transition-all
        duration-base
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        disabled:opacity-50
        disabled:cursor-not-allowed
        disabled:hover:shadow-none
        disabled:active:scale-100
        focus:outline-none
        focus-visible:ring-4
        focus-visible:ring-yellow-400
        focus-visible:ring-opacity-50
      `}
      style={{
        borderRadius: '0',
        fontFamily: fontFamilies.heading,
        backdropFilter: 'blur(12px)',
      }}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={isLoading}
      aria-disabled={disabled || isLoading}
      onClick={handleClick}
      onKeyDown={onClick ? createKeyboardHandler(() => handleClick({} as any)) : undefined}
      tabIndex={disabled ? -1 : 0}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
