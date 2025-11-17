import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card = ({ children, className = '', hover = false }: CardProps) => {
  return (
    <div
      className={`p-6 ${
        hover ? 'hover:border-opacity-50 transition-colors' : ''
      } ${className}`}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        borderRadius: '0',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      }}
    >
      {children}
    </div>
  );
};
