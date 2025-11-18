import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Settings,
  Upload,
  FileText,
} from 'lucide-react';

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
    if (path === '/settings' && location.pathname === '/settings') return true;
    return false;
  };

  return (
    <aside className="w-64 bg-card border-r flex flex-col">
      {/* Logo/Branding */}
      <div className="h-16 flex items-center px-6 border-b">
        <h2 className="text-xl font-bold text-primary">WID3 Admin</h2>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors',
              isActive(item.path)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="border-t px-4 py-4">
        <div className="text-xs text-muted-foreground">
          <p className="font-semibold">Modpack Server</p>
          <p className="text-xs">Admin Panel v1.0</p>
        </div>
      </div>
    </aside>
  );
}
