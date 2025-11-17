import type { ServerState } from "../types/server";
import { motion } from "framer-motion";

interface StatusIndicatorProps {
  state: ServerState | null;
}

export function StatusIndicator({ state }: StatusIndicatorProps) {
  if (!state) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 rounded-full border border-slate-700/50 backdrop-blur-sm"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-slate-500 animate-pulse shadow-lg shadow-slate-500/50"></div>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unknown</span>
      </motion.div>
    );
  }

  const config = {
    stopped: {
      color: "bg-slate-500",
      shadow: "shadow-slate-500/50",
      label: "Stopped",
      textColor: "text-slate-400",
      borderColor: "border-slate-700/50",
      bgGradient: "from-slate-500/10 to-transparent",
    },
    starting: {
      color: "bg-amber-500 animate-pulse",
      shadow: "shadow-amber-500/50",
      label: "Starting",
      textColor: "text-amber-400",
      borderColor: "border-amber-700/50",
      bgGradient: "from-amber-500/10 to-transparent",
    },
    running: {
      color: "bg-emerald-500",
      shadow: "shadow-emerald-500/50",
      label: "Running",
      textColor: "text-emerald-400",
      borderColor: "border-emerald-700/50",
      bgGradient: "from-emerald-500/10 to-transparent",
    },
    stopping: {
      color: "bg-rose-500 animate-pulse",
      shadow: "shadow-rose-500/50",
      label: "Stopping",
      textColor: "text-rose-400",
      borderColor: "border-rose-700/50",
      bgGradient: "from-rose-500/10 to-transparent",
    },
  };

  const { color, shadow, label, textColor, borderColor, bgGradient } = config[state] || config.stopped;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${bgGradient} bg-slate-950/50 rounded-full border ${borderColor} backdrop-blur-sm overflow-hidden group`}
    >
      {/* Animated background gradient on hover */}
      <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-lg ${shadow}`}></div>
        <span className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>{label}</span>
      </div>
    </motion.div>
  );
}

