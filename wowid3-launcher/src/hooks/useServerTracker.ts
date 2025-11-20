import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TrackerState } from '../types/tracker';

export function useServerTracker(baseUrl: string, intervalMs: number = 5000) {
  const [state, setState] = useState<TrackerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedInitial = useRef(false);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;
    hasLoadedInitial.current = false;
    setState(null);

    const fetchStatus = async () => {
      const shouldShowLoading = !hasLoadedInitial.current;
      try {
        if (shouldShowLoading) {
            setLoading(true);
        }

        const result = await invoke<TrackerState>('cmd_get_detailed_server_status', { baseUrl });
        
        if (mounted) {
          setState(result);
          hasLoadedInitial.current = true;
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(String(err));
          console.error('Failed to fetch tracker status:', err);
        }
      } finally {
        if (mounted && shouldShowLoading) {
            setLoading(false);
        }
      }
    };

    fetchStatus();
    timer = window.setInterval(fetchStatus, intervalMs);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [baseUrl, intervalMs]);

  return { state, loading, error };
}

