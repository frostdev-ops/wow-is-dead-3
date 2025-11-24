import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Extract page title from current route
  const getPageTitle = () => {
    const pathname = location.pathname;
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/releases') return 'Releases';
    if (pathname.startsWith('/releases/') && pathname.endsWith('/edit')) return 'Edit Release';
    if (pathname === '/upload') return 'Upload Files';
    if (pathname === '/launcher') return 'Launcher Updates';
    if (pathname === '/cms') return 'CMS Configuration';
    if (pathname === '/settings') return 'Settings';
    return 'Admin Panel';
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-white/10 bg-background/40 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between h-16 px-6">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-white/70">{getPageTitle()}</h1>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2 hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
