import { usePlayerStats } from '../hooks/usePlayerStats';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { extractBaseUrl } from '../utils/url';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { StatCard } from './ui/StatCard';

function formatPlaytime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '0m';
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

function getRankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function getRankColor(rank: number): string {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-gray-300';
  if (rank === 3) return 'text-orange-400';
  return 'text-gray-500';
}

interface LeaderboardItemProps {
  rank: number;
  name: string;
  value: number;
  iconUrl?: string;
  maxValue: number;
}

function LeaderboardItem({ rank, name, value, iconUrl, maxValue }: LeaderboardItemProps) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-lg backdrop-blur-sm border border-white/20 hover:border-yellow-400/50 transition-all duration-200 hover:scale-102 hover:shadow-lg"
      style={{
        animationDelay: `${rank * 50}ms`,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      }}
    >
      <span className={`text-lg font-bold ${getRankColor(rank)} min-w-[3rem] drop-shadow-md`}>
        {getRankMedal(rank)}
      </span>

      {iconUrl && (
        <img
          src={iconUrl}
          alt={name}
          className="w-8 h-8 pixelated group-hover:scale-110 transition-transform drop-shadow-md"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-slate-200 truncate">{name}</span>
          <span className="text-sm font-bold text-white ml-2 drop-shadow-md">{value.toLocaleString()}</span>
        </div>
        <div className="w-full bg-slate-800/50 border border-slate-700/50 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-green-400 to-red-400 transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
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
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-red-400 mb-4 text-lg font-semibold drop-shadow-md">Error loading stats: {error}</p>
        <button
          onClick={refresh}
          className="px-6 py-3 bg-gradient-to-br from-yellow-500 to-yellow-600 text-slate-900 rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold shadow-xl border-2 border-yellow-400/50 hover:scale-105"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-slate-300 text-lg font-semibold">No stats available yet</p>
        <p className="text-slate-400 text-sm mt-2">Play on the server to start tracking your progress!</p>
      </div>
    );
  }

  const topBlocksBroken = getTopItems(stats.blocks_broken);
  const topMobsKilled = getTopItems(stats.mobs_killed);
  const topMobsTamed = getTopItems(stats.mobs_tamed);
  const topOresMined = getTopItems(stats.ores_mined);
  const topFoodEaten = getTopItems(stats.food_eaten);

  const maxBlocks = topBlocksBroken[0]?.[1] || 1;
  const maxMobs = topMobsKilled[0]?.[1] || 1;
  const maxOres = topOresMined[0]?.[1] || 1;
  const maxFood = topFoodEaten[0]?.[1] || 1;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl flex flex-col items-center">
      {/* Centered Title */}
      <div className="text-center w-full">
        <h1 className="text-4xl font-bold text-white mb-2">
          📊 Player Statistics
        </h1>
        <p className="text-gray-400">Track your progress and achievements</p>
      </div>

      {/* Refresh Button */}
      <button
        onClick={refresh}
        disabled={loading}
        className="px-6 py-3 bg-gradient-to-br from-yellow-500 to-yellow-600 text-slate-900 rounded-lg hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 font-bold shadow-xl border-2 border-yellow-400/50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Refreshing...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </span>
        )}
      </button>

      {/* Content */}
      <div className="w-full">

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Playtime"
          value={formatPlaytime(stats.playtime_seconds)}
          icon="⏱️"
          color="gold"
          subtitle={`${(stats.playtime_seconds / 3600).toFixed(1)} hours`}
        />
        <StatCard
          label="Mobs Killed"
          value={stats.total_mobs_killed.toLocaleString()}
          icon="⚔️"
          color="red"
          subtitle="Total kills"
        />
        <StatCard
          label="Deaths"
          value={stats.deaths.toLocaleString()}
          icon="💀"
          color="orange"
          subtitle="Times fallen"
        />
        <StatCard
          label="K/D Ratio"
          value={stats.deaths > 0 ? (stats.total_mobs_killed / stats.deaths).toFixed(2) : stats.total_mobs_killed.toLocaleString()}
          icon="📈"
          color="green"
          subtitle={stats.deaths > 0 ? "Kills per death" : "Flawless!"}
        />
        <StatCard
          label="Damage Dealt"
          value={Math.round(stats.damage_dealt).toLocaleString()}
          icon="⚡"
          color="purple"
          subtitle="Total damage output"
        />
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Blocks Broken"
          value={stats.total_blocks_broken.toLocaleString()}
          icon="⛏️"
          color="blue"
        />
        <StatCard
          label="Blocks Placed"
          value={stats.total_blocks_placed.toLocaleString()}
          icon="🧱"
          color="green"
        />
        <StatCard
          label="Mobs Tamed"
          value={stats.total_mobs_tamed.toLocaleString()}
          icon="🐾"
          color="orange"
        />
        <StatCard
          label="Ores Mined"
          value={stats.total_ores_mined.toLocaleString()}
          icon="💎"
          color="purple"
        />
        <StatCard
          label="Food Eaten"
          value={stats.total_food_eaten.toLocaleString()}
          icon="🍗"
          color="red"
        />
      </div>

      {/* Mining & Gathering */}
      {topBlocksBroken.length > 0 && (
        <CollapsibleSection
          title="Mining & Gathering"
          icon="⛏️"
          count={stats.total_blocks_broken}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {topBlocksBroken.map(([blockId, count], idx) => (
              <LeaderboardItem
                key={blockId}
                rank={idx + 1}
                name={formatItemId(blockId)}
                value={count}
                iconUrl={getItemIconUrl(blockId)}
                maxValue={maxBlocks}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Precious Ores */}
      {topOresMined.length > 0 && (
        <CollapsibleSection
          title="Precious Ores"
          icon="💎"
          count={stats.total_ores_mined}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {topOresMined.map(([oreId, count], idx) => (
              <LeaderboardItem
                key={oreId}
                rank={idx + 1}
                name={formatItemId(oreId)}
                value={count}
                iconUrl={getItemIconUrl(oreId)}
                maxValue={maxOres}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Combat Stats */}
      {topMobsKilled.length > 0 && (
        <CollapsibleSection
          title="Combat Encounters"
          icon="⚔️"
          count={stats.total_mobs_killed}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {topMobsKilled.map(([mobId, count], idx) => (
              <LeaderboardItem
                key={mobId}
                rank={idx + 1}
                name={formatItemId(mobId)}
                value={count}
                maxValue={maxMobs}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Tamed Companions */}
      {topMobsTamed.length > 0 && (
        <CollapsibleSection
          title="Tamed Companions"
          icon="🐾"
          count={stats.total_mobs_tamed}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {topMobsTamed.map(([mobId, count], idx) => (
              <LeaderboardItem
                key={mobId}
                rank={idx + 1}
                name={formatItemId(mobId)}
                value={count}
                maxValue={topMobsTamed[0]?.[1] || 1}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Food Consumed */}
      {topFoodEaten.length > 0 && (
        <CollapsibleSection
          title="Food Consumed"
          icon="🍗"
          count={stats.total_food_eaten}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {topFoodEaten.map(([foodId, count], idx) => (
              <LeaderboardItem
                key={foodId}
                rank={idx + 1}
                name={formatItemId(foodId)}
                value={count}
                iconUrl={getItemIconUrl(foodId)}
                maxValue={maxFood}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Exploration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.dimensions_visited.length > 0 && (
          <CollapsibleSection
            title="Dimensions Explored"
            icon="🌍"
            count={stats.dimensions_visited.length}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-2">
              {stats.dimensions_visited.map((dim) => (
                <div
                  key={dim}
                  className="flex items-center gap-3 p-3 rounded-lg backdrop-blur-sm border border-purple-400/30 hover:border-purple-400/60 transition-all"
                  style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}
                >
                  <span className="text-2xl drop-shadow-md">
                    {dim.includes('nether') ? '🔥' : dim.includes('end') ? '🌌' : '🌎'}
                  </span>
                  <span className="text-slate-200 font-semibold">{formatItemId(dim)}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {stats.biomes_visited.length > 0 && (
          <CollapsibleSection
            title="Biomes Discovered"
            icon="🗺️"
            count={stats.biomes_visited.length}
            defaultOpen={false}
          >
            <div className="max-h-96 overflow-y-auto pr-2 space-y-1">
              {stats.biomes_visited.map((biome) => (
                <div
                  key={biome}
                  className="flex items-center gap-2 p-2 rounded backdrop-blur-sm border border-green-400/20 hover:border-green-400/40 transition-colors text-sm"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                >
                  <span className="text-green-400 font-bold">✓</span>
                  <span className="text-slate-300 font-medium">{formatItemId(biome)}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
      </div>
    </div>
  );
}
