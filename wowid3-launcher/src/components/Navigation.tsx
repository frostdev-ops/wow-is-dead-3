import { MapViewerButton } from './MapViewerButton';
import { Home, BarChart3, Settings } from 'lucide-react';

interface NavigationProps {
  activeTab: 'home' | 'settings' | 'stats';
  onTabChange: (tab: 'home' | 'settings' | 'stats') => void;
}

export const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
      {/* Left side: Main navigation tabs */}
      <div className="flex gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right side: Utility buttons */}
      <div className="flex gap-1">
        <MapViewerButton />
      </div>
    </div>
  );
};
