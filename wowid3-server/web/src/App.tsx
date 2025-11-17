import { ServerControl } from "./components/ServerControl";
import { ServerStats } from "./components/ServerStats";
import { LogViewer } from "./components/LogViewer";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0f0f] via-[#0d0808] to-[#1a0f0f] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-[#ffd700] via-[#0f8a5f] to-[#ffd700] bg-clip-text text-transparent">
            wowid3 Server Manager
          </h1>
          <p className="text-gray-400 text-lg">Manage your Minecraft server with ease</p>
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

