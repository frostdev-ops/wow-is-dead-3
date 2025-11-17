import { useServer } from "../hooks/useServer";

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

export function ServerStats() {
  const { stats } = useServer();

  if (!stats) {
    return (
      <div className="bg-[#1a0f0f] border-2 border-[#0f8a5f] rounded-xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(15,138,95,0.2)]">
        <h2 className="text-2xl font-bold text-white mb-4">Statistics</h2>
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a0f0f] border-2 border-[#0f8a5f] rounded-xl p-6 backdrop-blur-sm shadow-[0_0_20px_rgba(15,138,95,0.2)]">
      <h2 className="text-2xl font-bold text-white mb-6">Statistics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-black/30 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Uptime</div>
          <div className="text-xl font-bold text-[#ffd700]">
            {formatUptime(stats.status.uptime_seconds)}
          </div>
        </div>
        <div className="bg-black/30 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Memory</div>
          <div className="text-xl font-bold text-[#0f8a5f]">
            {formatBytes(stats.memory_usage_mb)}
          </div>
        </div>
        <div className="bg-black/30 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">CPU</div>
          <div className="text-xl font-bold text-[#ffd700]">
            {stats.cpu_usage_percent !== null
              ? `${stats.cpu_usage_percent.toFixed(1)}%`
              : "N/A"}
          </div>
        </div>
        <div className="bg-black/30 rounded-lg p-4 border border-gray-800">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Players</div>
          <div className="text-xl font-bold text-[#0f8a5f]">
            {stats.player_count !== null && stats.max_players !== null
              ? `${stats.player_count}/${stats.max_players}`
              : stats.player_count !== null
              ? `${stats.player_count}`
              : "N/A"}
          </div>
        </div>
        {stats.tps !== null && (
          <div className="bg-black/30 rounded-lg p-4 border border-gray-800">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">TPS</div>
            <div className="text-xl font-bold text-[#ffd700]">
              {stats.tps.toFixed(1)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

