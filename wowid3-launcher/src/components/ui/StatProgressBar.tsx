import { useState, useEffect } from 'react';

interface StatProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  showPercentage?: boolean;
  animate?: boolean;
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

export function StatProgressBar({
  value,
  max,
  label,
  color = 'blue',
  showPercentage = true,
  animate = true
}: StatProgressBarProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  useEffect(() => {
    if (animate) {
      const duration = 1000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    } else {
      setDisplayValue(value);
    }
  }, [value, animate]);

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1 text-sm">
          <span className="text-gray-300">{label}</span>
          {showPercentage && (
            <span className="text-gray-400">{displayValue.toLocaleString()} / {max.toLocaleString()}</span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-1000 ease-out rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
