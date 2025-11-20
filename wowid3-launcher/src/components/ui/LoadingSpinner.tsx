import { useAccessibility } from '../../hooks/useAccessibility';
import { christmasSemanticColors, fontFamilies, fontSize } from '../../themes/tokens';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  fullscreen?: boolean;
  color?: 'primary' | 'secondary' | 'error' | 'success' | 'info';
}

const spinnerColorMap = {
  primary: christmasSemanticColors.primary,
  secondary: christmasSemanticColors.secondary,
  error: christmasSemanticColors.error,
  success: christmasSemanticColors.success,
  info: christmasSemanticColors.info,
};

export const LoadingSpinner = ({ size = 'md', message, fullscreen = false, color = 'error' }: LoadingSpinnerProps) => {
  const { prefersReducedMotion } = useAccessibility();

  const sizeConfig = {
    sm: { spinner: 'w-6 h-6', gap: 'gap-2', textSize: fontSize.xs },
    md: { spinner: 'w-12 h-12', gap: 'gap-3', textSize: fontSize.sm },
    lg: { spinner: 'w-16 h-16', gap: 'gap-4', textSize: fontSize.base },
    xl: { spinner: 'w-24 h-24', gap: 'gap-6', textSize: fontSize.lg },
  };

  const config = sizeConfig[size];
  const spinnerColor = spinnerColorMap[color];

  const spinnerContent = (
    <>
      <div className={`${config.spinner} relative`}>
        {prefersReducedMotion ? (
          // Static loading indicator for reduced motion
          <svg
            style={{ color: spinnerColor }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <circle
              className="opacity-75"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="31.4"
              strokeDashoffset="7.85"
            />
          </svg>
        ) : (
          // Animated spinner
          <svg
            className="animate-spin drop-shadow-lg"
            style={{ color: spinnerColor }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            role="status"
            aria-label={message || 'Loading'}
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
      </div>
      {message && (
        <p
          className="font-medium"
          style={{
            color: christmasSemanticColors.textSecondary,
            fontFamily: fontFamilies.body,
            fontSize: config.textSize,
          }}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-50">
        {spinnerContent}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${config.gap} p-8`}>
      {spinnerContent}
    </div>
  );
};
