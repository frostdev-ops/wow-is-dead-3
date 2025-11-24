import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Settings,
  Upload,
  FileText,
  Archive,
  Rocket,
  Network,
  Palette,
} from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      label: 'Drafts',
      path: '/drafts',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      label: 'Releases',
      path: '/releases',
      icon: <Package className="w-5 h-5" />,
    },
    {
      label: 'Upload',
      path: '/upload',
      icon: <Upload className="w-5 h-5" />,
    },
    {
      label: 'Resources',
      path: '/resources',
      icon: <Archive className="w-5 h-5" />,
    },
    {
      label: 'Launcher',
      path: '/admin/launcher',
      icon: <Rocket className="w-5 h-5" />,
    },
    {
      label: 'VPN',
      path: '/vpn',
      icon: <Network className="w-5 h-5" />,
    },
    {
      label: 'CMS',
      path: '/cms',
      icon: <Palette className="w-5 h-5" />,
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    if (path === '/drafts' && location.pathname === '/drafts') return true;
    if (path === '/releases' && location.pathname.startsWith('/releases')) return true;
    if (path === '/upload' && location.pathname === '/upload') return true;
    if (path === '/resources' && location.pathname === '/resources') return true;
    if (path === '/admin/launcher' && location.pathname.startsWith('/admin/launcher')) return true;
    if (path === '/vpn' && location.pathname === '/vpn') return true;
    if (path === '/cms' && location.pathname === '/cms') return true;
    if (path === '/settings' && location.pathname === '/settings') return true;
    return false;
  };

  return (
    <aside className="w-64 h-full glass-panel flex flex-col z-20">
      {/* Logo/Branding */}
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/20">
             <span className="text-white font-bold">W</span>
          </div>
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-white/70">Admin</h2>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        <LayoutGroup>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group overflow-hidden',
                  active
                    ? 'text-white shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-gradient-to-r from-primary to-indigo-600 rounded-xl -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                
                <span className="relative z-10 flex items-center gap-3">
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </span>
                
                {/* Glow effect on hover for non-active items */}
                {!active && (
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                )}
              </button>
            );
          })}
        </LayoutGroup>
      </nav>

      {/* Footer Info */}
      <div className="border-t border-white/10 px-6 py-6 bg-black/20 backdrop-blur-sm">
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground/80">Modpack Server</p>
          <div className="flex items-center justify-between">
            <p className="text-xs opacity-70">v1.0.0</p>
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          </div>
        </div>
      </div>
    </aside>
  );
}
