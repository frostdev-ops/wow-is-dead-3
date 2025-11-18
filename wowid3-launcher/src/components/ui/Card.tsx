import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  borderColor?: string;
  glowColor?: string;
}

export const Card = ({ children, className = '', hover = false, borderColor = 'rgba(255, 255, 255, 0.3)', glowColor = 'rgba(255, 255, 255, 0.3)' }: CardProps) => {
  return (
    <div
      className={`p-6 ${
        hover ? 'hover:border-opacity-50 transition-colors' : ''
      } ${className}`}
      style={{
        backgroundColor: 'transparent',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: `1px solid ${borderColor}`,
        boxShadow: `0 0 20px ${glowColor}, 0 25px 50px -12px rgb(0 0 0 / 0.25)`,
      }}
    >
      {children}
    </div>
  );
};
