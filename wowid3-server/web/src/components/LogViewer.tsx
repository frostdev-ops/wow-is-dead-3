import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

type LogEntry = {
  id: number;
  text: string;
};

export function LogViewer() {
  // Animated, efficient log list with batching and auto-follow
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const idRef = useRef(1);
  const bufferRef = useRef<LogEntry[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const autoFollowRef = useRef(true);

  const MAX_LINES = 2000; // memory cap
  const BATCH_MS = 100; // batch interval for smoother animations

  const isNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const threshold = 48; // px
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  const jumpToBottom = (smooth: boolean) => {
    const el = endRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  const onScroll = () => {
    // Update auto-follow state based on whether user is near the bottom
    const atBottom = isNearBottom();
    autoFollowRef.current = atBottom;
    if (atBottom) {
      setPendingCount(0);
    }
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      const buffered = bufferRef.current;
      if (buffered.length === 0) return;

      setEntries((prev) => {
        const merged = [...prev, ...buffered];
        bufferRef.current = [];
        // Cap lines to keep memory bounded
        const trimmed =
          merged.length > MAX_LINES ? merged.slice(merged.length - MAX_LINES) : merged;

        // If user isn't at bottom, track pending count
        if (!autoFollowRef.current) {
          const added = merged.length - prev.length;
          setPendingCount((c) => c + added);
        }

        return trimmed;
      });

      // Smoothly auto-follow only when near the bottom
      if (autoFollowRef.current) {
        // Use smooth scroll only once per batch for performance
        requestAnimationFrame(() => jumpToBottom(true));
      }
    }, BATCH_MS);
  };

  useEffect(() => {
    let isMounted = true;
    const ac = new AbortController();

    // Initial fetch (last N lines)
    axios
      .get<string[]>(`${API_BASE}/logs?tail=200`, { signal: ac.signal })
      .then((res) => {
        if (!isMounted) return;
        const mapped = res.data.map((text) => ({ id: idRef.current++, text }));
        setEntries(mapped);
        // Start scrolled to bottom on first load
        requestAnimationFrame(() => jumpToBottom(false));
      })
      .catch(() => {});

    // SSE stream
    const es = new EventSource(`${API_BASE}/logs/stream`);
    eventSourceRef.current = es;

    es.onopen = () => isMounted && setIsConnected(true);
    es.onerror = () => isMounted && setIsConnected(false);
    es.onmessage = (ev) => {
      if (!isMounted) return;
      bufferRef.current.push({ id: idRef.current++, text: ev.data });
      scheduleFlush();
    };

    return () => {
      isMounted = false;
      ac.abort();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      bufferRef.current = [];
    };
  }, []);

  const handleJumpToLatest = () => {
    autoFollowRef.current = true;
    setPendingCount(0);
    jumpToBottom(true);
  };

  return (
    <div className="bg-[#1a0f0f] border-2 border-[#0f8a5f] rounded-xl p-6 h-full flex flex-col backdrop-blur-sm shadow-[0_0_20px_rgba(15,138,95,0.2)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Server Logs</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              } shadow-lg`}
            />
            <span className="text-sm text-gray-400 font-medium">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {pendingCount > 0 && !autoFollowRef.current && (
            <button
              onClick={handleJumpToLatest}
              className="px-3 py-1 rounded bg-[#0f8a5f] text-white font-medium hover:bg-[#0c6b4a] transition-colors"
            >
              {pendingCount} new
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto bg-black rounded-lg p-4 font-mono text-sm border border-gray-800 shadow-inner"
        style={{ willChange: "transform" }}
      >
        {entries.length === 0 ? (
          <div className="text-gray-500">No logs available</div>
        ) : (
          <motion.div layout="position">
            <AnimatePresence initial={false}>
              {entries.map((entry) => (
                <motion.div
                  key={entry.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className={formatLogLine(entry.text)}
                >
                  <span className="whitespace-pre-wrap">{entry.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function formatLogLine(line: string) {
  if (line.includes("[STDOUT]")) {
    return "text-green-400";
  } else if (line.includes("[STDERR]")) {
    return "text-red-400";
  } else if (line.includes("[CMD]")) {
    return "text-yellow-400";
  } else if (line.includes("ERROR") || line.includes("error")) {
    return "text-red-500";
  } else if (line.includes("WARN") || line.includes("warn")) {
    return "text-yellow-500";
  }
  return "text-gray-300";
}
import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export function LogViewer() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    if (logEndRef.current) {
      // Use instant scroll for performance, smooth is expensive
      logEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  };

  useEffect(() => {
    let isMounted = true;
    let abortController = new AbortController();

    // Load initial logs
    axios
      .get<string[]>(`${API_BASE}/logs?tail=100`, {
        signal: abortController.signal,
      })
      .then((response) => {
        if (isMounted) {
          setLogs(response.data);
          scrollToBottom();
        }
      })
      .catch((error) => {
        if (error.name !== 'CanceledError' && isMounted) {
          console.error("Failed to load logs:", error);
        }
      });

    // Connect to SSE stream
    const eventSource = new EventSource(`${API_BASE}/logs/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (isMounted) {
        setIsConnected(true);
      }
    };

    eventSource.onerror = () => {
      if (isMounted) {
        setIsConnected(false);
      }
    };

    eventSource.onmessage = (event) => {
      if (isMounted) {
        setLogs((prev) => {
          const newLogs = [...prev, event.data];
          // Keep only last 500 lines to reduce memory
          return newLogs.slice(-500);
        });
        // Throttle scroll to bottom
        requestAnimationFrame(() => {
          if (isMounted) {
            scrollToBottom();
          }
        });
      }
    };

    return () => {
      isMounted = false;
      abortController.abort();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Remove this effect - we handle scrolling in onmessage callback
  // Too many re-renders with this effect

  const formatLogLine = (line: string) => {
    // Color code different log types
    if (line.includes("[STDOUT]")) {
      return "text-green-400";
    } else if (line.includes("[STDERR]")) {
      return "text-red-400";
    } else if (line.includes("[CMD]")) {
      return "text-yellow-400";
    } else if (line.includes("ERROR") || line.includes("error")) {
      return "text-red-500";
    } else if (line.includes("WARN") || line.includes("warn")) {
      return "text-yellow-500";
    }
    return "text-gray-300";
  };

  return (
    <div className="bg-[#1a0f0f] border-2 border-[#0f8a5f] rounded-xl p-6 h-full flex flex-col backdrop-blur-sm shadow-[0_0_20px_rgba(15,138,95,0.2)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Server Logs</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            } shadow-lg`}
          ></div>
          <span className="text-sm text-gray-400 font-medium">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-black rounded-lg p-4 font-mono text-sm border border-gray-800 shadow-inner">
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs available</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`${formatLogLine(log)} whitespace-pre-wrap`}>
              {log}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

