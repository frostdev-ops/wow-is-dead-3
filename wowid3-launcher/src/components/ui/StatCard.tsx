import { ReactNode, useState } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: 'gold' | 'red' | 'green' | 'blue' | 'purple' | 'orange';
  subtitle?: string;
  trend?: 'up' | 'down';
  expandable?: boolean;
  expandedContent?: ReactNode;
}

const colorClasses = {
  gold: {
    border: 'border-yellow-400/40',
    bg: 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/10',
    icon: 'text-yellow-400',
    glow: 'hover:shadow-[0_0_20px_rgba(255,215,0,0.2)]'
  },
  red: {
    border: 'border-red-400/40',
    bg: 'bg-gradient-to-br from-red-900/20 to-red-800/10',
    icon: 'text-red-400',
    glow: 'hover:shadow-[0_0_20px_rgba(220,38,38,0.2)]'
  },
  green: {
    border: 'border-green-400/40',
    bg: 'bg-gradient-to-br from-green-900/20 to-green-800/10',
    icon: 'text-green-400',
    glow: 'hover:shadow-[0_0_20px_rgba(22,163,74,0.2)]'
  },
  blue: {
    border: 'border-blue-400/40',
    bg: 'bg-gradient-to-br from-blue-900/20 to-blue-800/10',
    icon: 'text-blue-400',
    glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]'
  },
  purple: {
    border: 'border-purple-400/40',
    bg: 'bg-gradient-to-br from-purple-900/20 to-purple-800/10',
    icon: 'text-purple-400',
    glow: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]'
  },
  orange: {
    border: 'border-orange-400/40',
    bg: 'bg-gradient-to-br from-orange-900/20 to-orange-800/10',
    icon: 'text-orange-400',
    glow: 'hover:shadow-[0_0_20px_rgba(251,146,60,0.2)]'
  },
};

export function StatCard({
  label,
  value,
  icon,
  color = 'gold',
  subtitle,
  trend,
  expandable = false,
  expandedContent
}: StatCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = colorClasses[color];

  return (
    <div
      className={`
        ${colors.bg}
        ${colors.border}
        ${colors.glow}
        backdrop-blur-md
        border-2
        rounded-lg
        p-5
        transition-all
        duration-300
        hover:scale-105
        ${expandable ? 'cursor-pointer' : ''}
        shadow-xl
      `}
      onClick={() => expandable && setIsExpanded(!isExpanded)}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-extrabold text-white drop-shadow-lg">
              {value}
            </p>
            {trend && (
              <span className={`text-sm font-bold ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                {trend === 'up' ? '↑' : '↓'}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-2 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={`text-5xl ${colors.icon} opacity-90 drop-shadow-md`}>
            {icon}
          </div>
        )}
      </div>

      {expandable && isExpanded && expandedContent && (
        <div className="mt-4 pt-4 border-t border-slate-600/50 animate-fadeIn">
          {expandedContent}
        </div>
      )}
    </div>
  );
}
