import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = ({
  label,
  error,
  helperText,
  className,
  ...props
}: InputProps) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold mb-2" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 text-white placeholder-slate-400 focus:outline-none ${
          error ? 'border-red-500' : ''
        } ${className || ''}`}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: error ? '1px solid #ef4444' : '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '0',
          fontFamily: "'Trebuchet MS', sans-serif",
        }}
        {...props}
      />
      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
      {helperText && !error && <p className="text-sm mt-1" style={{ color: '#c6ebdaff' }}>{helperText}</p>}
    </div>
  );
};
