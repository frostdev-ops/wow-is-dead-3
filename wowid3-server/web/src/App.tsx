import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
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
const LauncherPage = lazy(() => import('./pages/LauncherPage'));
const DownloadPage = lazy(() => import('./pages/DownloadPage'));
const VpnPage = lazy(() => import('./pages/VpnPage'));
const CmsPage = lazy(() => import('./pages/CmsPage'));
const LauncherReleasesList = lazy(() => import('./pages/LauncherReleasesList').then(m => ({ default: m.LauncherReleasesList })));
const LauncherReleaseEditor = lazy(() => import('./pages/LauncherReleaseEditor').then(m => ({ default: m.LauncherReleaseEditor })));

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

// Animated routes wrapper - must be inside BrowserRouter to use useLocation
function AnimatedRoutes() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/" element={<DownloadPage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

        {/* Protected routes: Admin panel */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/drafts" element={<ProtectedRoute><DraftsPage /></ProtectedRoute>} />
        <Route path="/releases" element={<ProtectedRoute><ReleasesPage /></ProtectedRoute>} />
        <Route path="/releases/:id/edit" element={<ProtectedRoute><ReleaseEditorPage /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
        <Route path="/resources" element={<ProtectedRoute><ResourcePacksPage /></ProtectedRoute>} />
        <Route path="/launcher" element={<ProtectedRoute><LauncherPage /></ProtectedRoute>} />
        <Route path="/admin/launcher" element={<ProtectedRoute><LauncherReleasesList /></ProtectedRoute>} />
        <Route path="/admin/launcher/new" element={<ProtectedRoute><LauncherReleaseEditor /></ProtectedRoute>} />
        <Route path="/cms" element={<ProtectedRoute><CmsPage /></ProtectedRoute>} />
        <Route path="/vpn" element={<ProtectedRoute><VpnPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

        {/* Catch-all: Redirect to dashboard or login */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const { loadTokenFromStorage } = useAuthStore();
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
            <AnimatedRoutes />
          </Suspense>
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
