import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';
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
    if (pathname === '/settings') return 'Settings';
    return 'Admin Panel';
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="flex items-center justify-between h-16 px-6">
            <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
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
