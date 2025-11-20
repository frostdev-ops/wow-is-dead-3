import { ReactNode } from 'react';
import { christmasSemanticColors, borderRadius, blur } from '../../themes/tokens';

type CardVariant = 'default' | 'info' | 'warning' | 'error' | 'success' | 'primary';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  variant?: CardVariant;
  // Legacy props for backward compatibility
  borderColor?: string;
  glowColor?: string;
}

const variantStyles = {
  default: {
    border: christmasSemanticColors.borderSecondary,
    glow: 'rgba(255, 255, 255, 0.3)',
  },
  primary: {
    border: christmasSemanticColors.borderPrimary,
    glow: 'rgba(255, 215, 0, 0.3)',
  },
  info: {
    border: `${christmasSemanticColors.info}80`, // 50% opacity
    glow: `${christmasSemanticColors.info}4D`, // 30% opacity
  },
  warning: {
    border: `${christmasSemanticColors.warning}80`,
    glow: `${christmasSemanticColors.warning}4D`,
  },
  error: {
    border: `${christmasSemanticColors.borderError}80`,
    glow: `${christmasSemanticColors.error}4D`,
  },
  success: {
    border: `${christmasSemanticColors.borderSuccess}80`,
    glow: `${christmasSemanticColors.success}4D`,
  },
};

export const Card = ({
  children,
  className = '',
  hover = false,
  variant = 'default',
  borderColor,
  glowColor,
}: CardProps) => {
  const getVariantStyles = () => {
    // Use legacy colors if provided (for backward compatibility)
    if (borderColor || glowColor) {
      return {
        border: borderColor || christmasSemanticColors.borderSecondary,
        glow: glowColor || 'rgba(255, 255, 255, 0.3)',
      };
    }

    return variantStyles[variant];
  };

  const styles = getVariantStyles();

  return (
    <div
      className={`p-6 transition-all duration-base ${
        hover ? 'hover:border-opacity-70 hover:shadow-lg' : ''
      } ${className}`}
      style={{
        backgroundColor: 'transparent',
        backdropFilter: blur.md,
        borderRadius: borderRadius.lg,
        border: `2px solid ${styles.border}`,
        boxShadow: `0 0 20px ${styles.glow}, 0 25px 50px -12px rgb(0 0 0 / 0.25)`,
      }}
    >
      {children}
    </div>
  );
};
