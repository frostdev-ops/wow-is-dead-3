import { useEffect, useRef } from "react";
import { useServerStore } from "../stores/serverStore";
import type { ServerState } from "../types/server";

export function useServer() {
  const {
    status,
    stats,
    isLoading,
    error,
    fetchStatus,
    fetchStats,
    startServer,
    stopServer,
    restartServer,
    sendCommand,
  } = useServerStore();

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchStatus();
    fetchStats();

    // Poll every 2 seconds when server is running
    const startPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = window.setInterval(() => {
        fetchStatus();
        fetchStats();
      }, 2000);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (status?.state === "running") {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [status?.state, fetchStatus, fetchStats]);

  const canStart = status?.state === "stopped";
  const canStop = status?.state === "running";
  const canRestart = status?.state === "running" || status?.state === "stopped";

  return {
    status,
    stats,
    isLoading,
    error,
    canStart,
    canStop,
    canRestart,
    startServer,
    stopServer,
    restartServer,
    sendCommand,
    refreshStatus: fetchStatus,
    refreshStats: fetchStats,
  };
}

