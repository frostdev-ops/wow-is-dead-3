import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PlayerStats } from '../types/stats';

export interface UsePlayerStatsResult {
  stats: PlayerStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePlayerStats(uuid: string | null, serverUrl: string, autoRefresh: boolean = true): UsePlayerStatsResult {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!uuid) return;
    
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<PlayerStats>('cmd_get_player_stats', { uuid, serverUrl });
      setStats(result);
    } catch (err) {
      setError(String(err));
      console.error('Failed to fetch player stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [uuid, serverUrl, autoRefresh]);

  return { stats, loading, error, refresh: fetchStats };
}

