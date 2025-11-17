import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card = ({ children, className = '', hover = false }: CardProps) => {
  return (
    <div
      className={`rounded-lg bg-slate-800 border border-slate-700 p-4 ${
        hover ? 'hover:border-slate-600 transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
