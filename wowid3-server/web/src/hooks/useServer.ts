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
    if (status?.state === "running") {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = window.setInterval(() => {
        fetchStatus();
        fetchStats();
      }, 2000);
    } else {
      // Clear interval when not running
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status?.state]); // Only depend on state, not functions

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

