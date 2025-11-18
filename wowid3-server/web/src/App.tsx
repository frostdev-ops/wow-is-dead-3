import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Layout } from './components/Layout';

// Performance: Lazy load pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReleasesPage = lazy(() => import('./pages/ReleasesPage'));
const ReleaseEditorPage = lazy(() => import('./pages/ReleaseEditorPage'));
const DraftsPage = lazy(() => import('./pages/DraftsPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const ResourcePacksPage = lazy(() => import('./pages/ResourcePacksPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Performance: Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner message="Loading..." />
  </div>
);

// Protected route wrapper - redirects unauthenticated users to login
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}

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

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public route: Login */}
              <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

              {/* Protected routes: Admin panel */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/drafts" element={<ProtectedRoute><DraftsPage /></ProtectedRoute>} />
              <Route path="/releases" element={<ProtectedRoute><ReleasesPage /></ProtectedRoute>} />
              <Route path="/releases/:id/edit" element={<ProtectedRoute><ReleaseEditorPage /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
              <Route path="/resources" element={<ProtectedRoute><ResourcePacksPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

              {/* Catch-all: Redirect to dashboard or login */}
              <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
            </Routes>
          </Suspense>
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
