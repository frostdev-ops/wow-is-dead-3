import { useEffect } from 'react';
import { useModpack, useServer } from './hooks';
import LauncherHome from './components/LauncherHome';
import ChristmasBackground from './components/theme/ChristmasBackground';
import './App.css';

function App() {
  const { checkUpdates } = useModpack();
  const { startPolling } = useServer();

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
      <div className="relative z-10 w-full h-full">
        <LauncherHome />
      </div>
    </div>
  );
}

export default App;
