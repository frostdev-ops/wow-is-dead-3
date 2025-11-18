import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuthStore } from './store/authStore';
import './App.css';

// Performance: Lazy load heavy components for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Performance: Loading fallback component
const LoadingFallback = () => (
  <div className="loading-screen">
    <div className="spinner"></div>
    <p>Loading...</p>
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
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Performance: Wrap lazy-loaded components in Suspense
  return (
    <Suspense fallback={<LoadingFallback />}>
      {isAuthenticated ? <Dashboard /> : <LoginPage />}
    </Suspense>
  );
}

export default App;
