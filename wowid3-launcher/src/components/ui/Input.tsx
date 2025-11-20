import { InputHTMLAttributes, useId } from 'react';
import { christmasSemanticColors, fontFamilies, borderRadius } from '../../themes/tokens';

type ValidationStatus = 'error' | 'success' | 'warning' | 'validating' | 'default';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  status?: ValidationStatus;
  successMessage?: string;
  warningMessage?: string;
}

export const Input = ({
  label,
  error,
  helperText,
  status = 'default',
  successMessage,
  warningMessage,
  className,
  disabled,
  ...props
}: InputProps) => {
  const inputId = useId();
  const helperId = useId();
  const errorId = useId();

  // Determine actual status based on props
  const actualStatus: ValidationStatus = error ? 'error' : status;

  const getBorderColor = () => {
    switch (actualStatus) {
      case 'error':
        return christmasSemanticColors.borderError;
      case 'success':
        return christmasSemanticColors.borderSuccess;
      case 'warning':
        return christmasSemanticColors.borderWarning;
      case 'validating':
        return christmasSemanticColors.info;
      default:
        return christmasSemanticColors.borderPrimary;
    }
  };

  const getMessage = () => {
    if (error) return { text: error, color: christmasSemanticColors.error };
    if (actualStatus === 'success' && successMessage) return { text: successMessage, color: christmasSemanticColors.success };
    if (actualStatus === 'warning' && warningMessage) return { text: warningMessage, color: christmasSemanticColors.warning };
    if (helperText) return { text: helperText, color: christmasSemanticColors.textSecondary };
    return null;
  };

  const getIcon = () => {
    switch (actualStatus) {
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'validating':
        return (
          <svg className="animate-spin w-5 h-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const message = getMessage();

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold mb-2"
          style={{ color: christmasSemanticColors.textSecondary, fontFamily: fontFamilies.body }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`w-full px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-base ${
            actualStatus !== 'default' ? 'pr-12' : ''
          } ${className || ''}`}
          style={{
            backgroundColor: christmasSemanticColors.bgPrimary,
            border: `2px solid ${getBorderColor()}`,
            borderRadius: borderRadius.none,
            fontFamily: fontFamilies.body,
          }}
          aria-invalid={actualStatus === 'error'}
          aria-describedby={message ? helperId : undefined}
          disabled={disabled}
          {...props}
        />
        {getIcon() && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {getIcon()}
          </div>
        )}
      </div>
      {message && (
        <p
          id={actualStatus === 'error' ? errorId : helperId}
          className="text-sm mt-2 flex items-start gap-1"
          style={{ color: message.color, fontFamily: fontFamilies.body }}
          role={actualStatus === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </div>
  );
};
