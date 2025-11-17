import { useServer } from "../hooks/useServer";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

function formatUptime(seconds: number | null): string {
  if (!seconds) return "N/A";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatBytes(mb: number | null): string {
  if (!mb) return "N/A";
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000; // 1 second
    const steps = 60;
    const stepValue = (value - displayValue) / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setDisplayValue((prev) => {
        const newValue = prev + stepValue;
        return currentStep >= steps ? value : newValue;
      });

      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <span>
      {displayValue.toFixed(1)}
      {suffix}
    </span>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  color: string;
  progress?: number;
}

function StatCard({ icon, label, value, color, progress }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className="relative overflow-hidden group"
    >
      {/* Glow effect */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${color} rounded-xl opacity-0 group-hover:opacity-30 blur transition duration-300`} />

      <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
            {label}
          </div>
          <div className="text-slate-500">{icon}</div>
        </div>

        <div className={`text-2xl font-bold bg-gradient-to-br ${color} bg-clip-text text-transparent mb-2`}>
          {value}
        </div>

        {progress !== undefined && (
          <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color} rounded-full`}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ServerStats() {
  const { stats } = useServer();

  if (!stats) {
    return (
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-20 blur transition duration-500" />
        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Statistics
          </h2>
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-slate-400">Loading server statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  const memoryPercent = stats.memory_usage_mb ? Math.min((stats.memory_usage_mb / 4096) * 100, 100) : 0;
  const cpuPercent = stats.cpu_usage_percent || 0;
  const playerPercent = stats.max_players ? (stats.player_count || 0) / stats.max_players * 100 : 0;
  const tpsPercent = stats.tps ? Math.min((stats.tps / 20) * 100, 100) : 0;

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-20 blur transition duration-500" />

      <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6">
          Statistics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            }
            label="Uptime"
            value={formatUptime(stats.status.uptime_seconds)}
            color="from-amber-400 to-orange-500"
          />

          <StatCard
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>
            }
            label="Memory"
            value={formatBytes(stats.memory_usage_mb)}
            color="from-emerald-400 to-teal-500"
            progress={memoryPercent}
          />

          <StatCard
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h.01a1 1 0 100-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zM7 8a1 1 0 000 2h.01a1 1 0 000-2H7z" clipRule="evenodd" />
              </svg>
            }
            label="CPU Usage"
            value={
              stats.cpu_usage_percent !== null ? (
                <AnimatedCounter value={stats.cpu_usage_percent} suffix="%" />
              ) : (
                "N/A"
              )
            }
            color="from-cyan-400 to-blue-500"
            progress={cpuPercent}
          />

          <StatCard
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            }
            label="Players"
            value={
              stats.player_count !== null && stats.max_players !== null
                ? `${stats.player_count}/${stats.max_players}`
                : stats.player_count !== null
                ? `${stats.player_count}`
                : "N/A"
            }
            color="from-purple-400 to-pink-500"
            progress={playerPercent}
          />

          {stats.tps !== null && (
            <StatCard
              icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              }
              label="TPS"
              value={<AnimatedCounter value={stats.tps} />}
              color="from-yellow-400 to-amber-500"
              progress={tpsPercent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

