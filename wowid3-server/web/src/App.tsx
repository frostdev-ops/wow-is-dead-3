import { ServerControl } from "./components/ServerControl";
import { ServerStats } from "./components/ServerStats";
import { LogViewer } from "./components/LogViewer";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-christmas-darkBg to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-christmas-gold mb-2">
            wowid3 Server Manager
          </h1>
          <p className="text-gray-400">Manage your Minecraft server with ease</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <ServerControl />
            <ServerStats />
          </div>
          <div className="lg:col-span-2">
            <LogViewer />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

