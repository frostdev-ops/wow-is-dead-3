import { useState } from "react";
import { useServer } from "../hooks/useServer";
import { StatusIndicator } from "./StatusIndicator";
import { motion } from "framer-motion";

export function ServerControl() {
  const {
    status,
    isLoading,
    canStart,
    canStop,
    canRestart,
    startServer,
    stopServer,
    restartServer,
    sendCommand,
  } = useServer();

  const [command, setCommand] = useState("");
  const [sendingCommand, setSendingCommand] = useState(false);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    setSendingCommand(true);
    try {
      await sendCommand(command);
      setCommand("");
    } catch (error) {
      console.error("Failed to send command:", error);
    } finally {
      setSendingCommand(false);
    }
  };

  return (
    <div className="relative group">
      {/* Glow effect on hover */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-20 blur transition duration-500" />

      <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Server Control
          </h2>
          <StatusIndicator state={status?.state || null} />
        </div>

        <div className="flex gap-3 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={startServer}
            disabled={!canStart || isLoading}
            className="relative px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-emerald-500/50 disabled:hover:shadow-lg overflow-hidden group/btn"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-300 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200" />
            <span className="relative flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Start
            </span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={stopServer}
            disabled={!canStop || isLoading}
            className="relative px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-rose-500/50 disabled:hover:shadow-lg overflow-hidden group/btn"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-rose-400 to-rose-300 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200" />
            <span className="relative flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              Stop
            </span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={restartServer}
            disabled={!canRestart || isLoading}
            className="relative px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-amber-500/50 disabled:hover:shadow-lg overflow-hidden group/btn"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-300 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200" />
            <span className="relative flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Restart
            </span>
          </motion.button>
        </div>

        <form onSubmit={handleCommand} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter server command (e.g., /say Hello)"
              disabled={status?.state !== "running" || sendingCommand}
              className="w-full px-4 py-3 bg-slate-950/50 text-white rounded-xl border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-slate-500 transition-all duration-200"
            />
            {sendingCommand && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={status?.state !== "running" || sendingCommand || !command.trim()}
            className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-cyan-500/50"
          >
            Send
          </motion.button>
        </form>
      </div>
    </div>
  );
}

