import { useState, ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}

export function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  count
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className="backdrop-blur-md border-2 border-white/30 rounded-lg overflow-hidden transition-all duration-300 hover:border-yellow-400/50 shadow-xl"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-3xl group-hover:scale-110 transition-transform">
              {icon}
            </div>
          )}
          <h2 className="text-2xl font-bold text-white drop-shadow-md">
            {title}
          </h2>
          {count !== undefined && (
            <span className="px-3 py-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 rounded-full text-sm font-bold shadow-lg">
              {count.toLocaleString()}
            </span>
          )}
        </div>
        <svg
          className={`w-6 h-6 text-yellow-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} drop-shadow-md`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="px-6 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
