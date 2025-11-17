import { ServerControl } from "./components/ServerControl";
import { ServerStats } from "./components/ServerStats";
import { LogViewer } from "./components/LogViewer";
import { motion } from "framer-motion";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background gradients */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="fixed inset-0 bg-gradient-to-tr from-cyan-950/20 via-transparent to-purple-950/20" />

      {/* Animated orbs */}
      <div
        className="fixed top-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"
        style={{ animation: "pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
      />
      <div
        className="fixed bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
        style={{ animation: "pulse 12s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
      />

      {/* Grid pattern overlay */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <motion.h1
              className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent bg-[length:200%_auto]"
              style={{
                animation: "gradient 4s ease infinite",
              }}
            >
              wowid3
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="space-y-2"
            >
              <p className="text-cyan-300/90 text-xl font-semibold tracking-wide">
                Server Manager
              </p>
              <p className="text-slate-400 text-sm">
                Powerful Minecraft server control at your fingertips
              </p>
            </motion.div>
          </motion.header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-1 space-y-6"
            >
              <ServerControl />
              <ServerStats />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="lg:col-span-2"
            >
              <LogViewer />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

