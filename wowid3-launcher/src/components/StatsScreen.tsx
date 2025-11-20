import { usePlayerStats } from '../hooks/usePlayerStats';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Card } from './ui/Card';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { extractBaseUrl } from '../utils/url';

function formatPlaytime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  
  return parts.length > 0 ? parts.join(', ') : '0 minutes';
}

function getTopItems(items: Record<string, number>, limit: number = 10): Array<[string, number]> {
  return Object.entries(items)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

function formatItemId(itemId: string): string {
  return itemId
    .replace('minecraft:', '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getItemIconUrl(itemId: string): string {
  const cleanId = itemId.replace('minecraft:', '');
  return `https://mc-heads.net/item/${cleanId}`;
}

export function StatsScreen() {
  const { user } = useAuthStore();
  const { manifestUrl } = useSettingsStore();
  const serverUrl = extractBaseUrl(manifestUrl);
  const { stats, loading, error, refresh } = usePlayerStats(user?.uuid || null, serverUrl);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" message="Loading stats..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-red-500 mb-4">Error loading stats: {error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">No stats available</p>
      </div>
    );
  }

  const topBlocksBroken = getTopItems(stats.blocks_broken);
  const topMobsKilled = getTopItems(stats.mobs_killed);
  const topMobsTamed = getTopItems(stats.mobs_tamed);
  const topOresMined = getTopItems(stats.ores_mined);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Player Statistics</h1>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-lg font-semibold mb-2">Playtime</h3>
          <p className="text-2xl font-bold">{formatPlaytime(stats.playtime_seconds)}</p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold mb-2">Damage Dealt</h3>
          <p className="text-2xl font-bold">{Math.round(stats.damage_dealt).toLocaleString()}</p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold mb-2">Damage Taken</h3>
          <p className="text-2xl font-bold">{Math.round(stats.damage_taken).toLocaleString()}</p>
        </Card>
      </div>

      {/* Totals Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <h3 className="text-sm font-semibold mb-1">Blocks Broken</h3>
          <p className="text-xl font-bold">{stats.total_blocks_broken.toLocaleString()}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-1">Blocks Placed</h3>
          <p className="text-xl font-bold">{stats.total_blocks_placed.toLocaleString()}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-1">Mobs Killed</h3>
          <p className="text-xl font-bold">{stats.total_mobs_killed.toLocaleString()}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-1">Mobs Tamed</h3>
          <p className="text-xl font-bold">{stats.total_mobs_tamed.toLocaleString()}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-1">Ores Mined</h3>
          <p className="text-xl font-bold">{stats.total_ores_mined.toLocaleString()}</p>
        </Card>
      </div>

      {/* Top Items Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topBlocksBroken.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">Top Blocks Broken</h3>
            <div className="space-y-2">
              {topBlocksBroken.map(([itemId, count], idx) => (
                <div key={itemId} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 w-6">{idx + 1}.</span>
                  <img
                    src={getItemIconUrl(itemId)}
                    alt={formatItemId(itemId)}
                    className="w-6 h-6"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="flex-1 text-sm">{formatItemId(itemId)}</span>
                  <span className="text-sm font-semibold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {topMobsKilled.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">Top Mobs Killed</h3>
            <div className="space-y-2">
              {topMobsKilled.map(([entityId, count], idx) => (
                <div key={entityId} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 w-6">{idx + 1}.</span>
                  <span className="flex-1 text-sm">{formatItemId(entityId)}</span>
                  <span className="text-sm font-semibold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {topMobsTamed.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">Mobs Tamed</h3>
            <div className="space-y-2">
              {topMobsTamed.map(([entityId, count], idx) => (
                <div key={entityId} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 w-6">{idx + 1}.</span>
                  <span className="flex-1 text-sm">{formatItemId(entityId)}</span>
                  <span className="text-sm font-semibold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {topOresMined.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">Ores Mined</h3>
            <div className="space-y-2">
              {topOresMined.map(([blockId, count], idx) => (
                <div key={blockId} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 w-6">{idx + 1}.</span>
                  <img
                    src={getItemIconUrl(blockId)}
                    alt={formatItemId(blockId)}
                    className="w-6 h-6"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="flex-1 text-sm">{formatItemId(blockId)}</span>
                  <span className="text-sm font-semibold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {stats.dimensions_visited.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">Dimensions Visited</h3>
            <div className="space-y-2">
              {stats.dimensions_visited.map((dim) => (
                <div key={dim} className="text-sm">{formatItemId(dim)}</div>
              ))}
            </div>
          </Card>
        )}

        {stats.biomes_visited.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold mb-4">Biomes Visited</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.biomes_visited.map((biome) => (
                <div key={biome} className="text-sm">{formatItemId(biome)}</div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

