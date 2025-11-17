import type { ServerState } from "../types/server";

interface StatusIndicatorProps {
  state: ServerState | null;
}

export function StatusIndicator({ state }: StatusIndicatorProps) {
  if (!state) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-gray-700">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-500 animate-pulse"></div>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Unknown</span>
      </div>
    );
  }

  const config = {
    stopped: { color: "bg-gray-500", label: "Stopped", textColor: "text-gray-400" },
    starting: { color: "bg-yellow-500 animate-pulse", label: "Starting", textColor: "text-yellow-400" },
    running: { color: "bg-green-500", label: "Running", textColor: "text-green-400" },
    stopping: { color: "bg-red-500 animate-pulse", label: "Stopping", textColor: "text-red-400" },
  };

  const { color, label, textColor } = config[state] || config.stopped;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-gray-700`}>
      <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-lg`}></div>
      <span className={`text-xs font-semibold uppercase tracking-wide ${textColor}`}>{label}</span>
    </div>
  );
}

