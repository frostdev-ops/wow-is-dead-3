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
      <div className="bg-christmas-darkBg border border-christmas-green rounded-lg p-6">
        <h2 className="text-2xl font-bold text-christmas-snow mb-4">Statistics</h2>
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-christmas-darkBg border border-christmas-green rounded-lg p-6">
      <h2 className="text-2xl font-bold text-christmas-snow mb-4">Statistics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-sm text-gray-400">Uptime</div>
          <div className="text-lg font-semibold text-christmas-snow">
            {formatUptime(stats.status.uptime_seconds)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Memory Usage</div>
          <div className="text-lg font-semibold text-christmas-snow">
            {formatBytes(stats.memory_usage_mb)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-400">CPU Usage</div>
          <div className="text-lg font-semibold text-christmas-snow">
            {stats.cpu_usage_percent !== null
              ? `${stats.cpu_usage_percent.toFixed(1)}%`
              : "N/A"}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Players</div>
          <div className="text-lg font-semibold text-christmas-snow">
            {stats.player_count !== null && stats.max_players !== null
              ? `${stats.player_count}/${stats.max_players}`
              : stats.player_count !== null
              ? `${stats.player_count}`
              : "N/A"}
          </div>
        </div>
        {stats.tps !== null && (
          <div>
            <div className="text-sm text-gray-400">TPS</div>
            <div className="text-lg font-semibold text-christmas-snow">
              {stats.tps.toFixed(1)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

