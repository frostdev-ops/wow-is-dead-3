import { useEffect, useState } from 'react';
import { useModpack, useServer, useTheme } from './hooks';
import LauncherHome from './components/LauncherHome';
import SettingsScreen from './components/SettingsScreen';
import ChristmasBackground from './components/theme/ChristmasBackground';
import { Navigation } from './components/Navigation';
import { ToastProvider } from './components/ui/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');
  const { checkUpdates } = useModpack();
  const { startPolling } = useServer();
  useTheme(); // Apply theme on mount

  useEffect(() => {
    // Check for modpack updates on startup
    checkUpdates().catch(console.error);

    // Start server polling
    startPolling(30);

    return () => {
      // Cleanup handled by useServer
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <ChristmasBackground />
      <div className="relative z-10 w-full h-full flex flex-col">
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 overflow-auto">
          {activeTab === 'home' && <LauncherHome />}
          {activeTab === 'settings' && <SettingsScreen />}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
