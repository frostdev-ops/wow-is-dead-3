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
    <div className="bg-christmas-darkBg border border-christmas-green rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-christmas-snow">Server Control</h2>
        <StatusIndicator state={status?.state || null} />
      </div>

      <div className="flex gap-4">
        <button
          onClick={startServer}
          disabled={!canStart || isLoading}
          className="px-6 py-2 bg-christmas-green text-white rounded-lg font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Start
        </button>
        <button
          onClick={stopServer}
          disabled={!canStop || isLoading}
          className="px-6 py-2 bg-christmas-red text-white rounded-lg font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Stop
        </button>
        <button
          onClick={restartServer}
          disabled={!canRestart || isLoading}
          className="px-6 py-2 bg-christmas-gold text-christmas-darkBg rounded-lg font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-christmas-green disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={status?.state !== "running" || sendingCommand || !command.trim()}
          className="px-6 py-2 bg-christmas-green text-white rounded-lg font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

