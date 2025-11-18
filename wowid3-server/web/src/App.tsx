import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Performance: Lazy load heavy components for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Performance: Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner message="Loading..." />
  </div>
);

function App() {
  const { isAuthenticated, loadTokenFromStorage } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTokenFromStorage();
    setIsLoading(false);
  }, [loadTokenFromStorage]);

  if (isLoading) {
    return <LoadingFallback />;
  }

  // Performance: Wrap lazy-loaded components in Suspense and ErrorBoundary
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Suspense fallback={<LoadingFallback />}>
          {isAuthenticated ? <Dashboard /> : <LoginPage />}
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
