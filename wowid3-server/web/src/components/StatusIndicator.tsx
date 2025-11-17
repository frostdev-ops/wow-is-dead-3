import type { ServerState } from "../types/server";

interface StatusIndicatorProps {
  state: ServerState | null;
}

export function StatusIndicator({ state }: StatusIndicatorProps) {
  if (!state) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-gray-400 animate-pulse"></div>
        <span className="text-gray-400">Unknown</span>
      </div>
    );
  }

  const config = {
    stopped: { color: "bg-gray-500", label: "Stopped" },
    starting: { color: "bg-yellow-500 animate-pulse", label: "Starting" },
    running: { color: "bg-green-500", label: "Running" },
    stopping: { color: "bg-red-500 animate-pulse", label: "Stopping" },
  };

  const { color, label } = config[state] || config.stopped;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <span className="text-sm font-medium capitalize">{label}</span>
    </div>
  );
}

