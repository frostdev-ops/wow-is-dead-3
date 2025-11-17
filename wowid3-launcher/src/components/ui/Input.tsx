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
      {label && <label className="block text-sm font-semibold text-slate-200 mb-2">{label}</label>}
      <input
        className={`w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 ${
          error ? 'border-red-500' : ''
        } ${className || ''}`}
        {...props}
      />
      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
      {helperText && !error && <p className="text-sm text-slate-400 mt-1">{helperText}</p>}
    </div>
  );
};
