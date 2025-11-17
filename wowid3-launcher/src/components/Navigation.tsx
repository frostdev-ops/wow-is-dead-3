interface NavigationProps {
  activeTab: 'home' | 'settings';
  onTabChange: (tab: 'home' | 'settings') => void;
}

export const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ] as const;

  return (
    <div className="flex gap-1 p-4 bg-slate-800 border-b border-slate-700">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded font-semibold transition-all ${
            activeTab === tab.id
              ? 'bg-red-600 text-white'
              : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};
