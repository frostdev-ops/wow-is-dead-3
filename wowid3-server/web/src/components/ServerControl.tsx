import { useState } from "react";
import { useServer } from "../hooks/useServer";
import { StatusIndicator } from "./StatusIndicator";

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
    <div className="bg-[#1a0f0f] border-2 border-[#0f8a5f] rounded-xl p-6 space-y-6 backdrop-blur-sm shadow-[0_0_20px_rgba(15,138,95,0.2)]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Server Control</h2>
        <StatusIndicator state={status?.state || null} />
      </div>

      <div className="flex gap-4 flex-wrap">
        <button
          onClick={startServer}
          disabled={!canStart || isLoading}
          className="px-6 py-3 bg-[#0f8a5f] text-white rounded-lg font-semibold hover:bg-[#0c6b4a] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
        >
          Start
        </button>
        <button
          onClick={stopServer}
          disabled={!canStop || isLoading}
          className="px-6 py-3 bg-[#c41e3a] text-white rounded-lg font-semibold hover:bg-[#991626] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
        >
          Stop
        </button>
        <button
          onClick={restartServer}
          disabled={!canRestart || isLoading}
          className="px-6 py-3 bg-[#ffd700] text-[#1a0f0f] rounded-lg font-semibold hover:bg-[#e6c200] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
        >
          Restart
        </button>
      </div>

      <form onSubmit={handleCommand} className="flex gap-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter server command (e.g., /say Hello)"
          disabled={status?.state !== "running" || sendingCommand}
          className="flex-1 px-4 py-2.5 bg-black/40 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f8a5f] focus:border-[#0f8a5f] disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500"
        />
        <button
          type="submit"
          disabled={status?.state !== "running" || sendingCommand || !command.trim()}
          className="px-6 py-2.5 bg-[#0f8a5f] text-white rounded-lg font-semibold hover:bg-[#0c6b4a] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
        >
          Send
        </button>
      </form>
    </div>
  );
}

