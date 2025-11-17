import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { LogLine, type LogEntry } from "./LogLine";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export function LogViewer() {
  // Keep entries with unique IDs for stable animation keys
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [pageSize, setPageSize] = useState(200);
  const [currentPage, setCurrentPage] = useState(1);
  const [paused, setPaused] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const idRef = useRef(1);
  const bufferRef = useRef<LogEntry[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const isOnLastPage = currentPage >= totalPages;

  // Compute page slice
  const pageSlice = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return entries.slice(start, end);
  }, [entries, currentPage, pageSize]);

  // Flush buffered SSE messages in batches for fewer re-renders
  const scheduleFlush = () => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      if (bufferRef.current.length === 0) return;

      setEntries((prev) => {
        const merged = [...prev, ...bufferRef.current];
        bufferRef.current = [];
        // Limit memory: keep only last 5000
        const max = 5000;
        return merged.length > max ? merged.slice(merged.length - max) : merged;
      });

      // Update pending counter if not on last page
      if (!isOnLastPage) {
        setPendingCount((c) => c + bufferRef.current.length);
      }
    }, 120);
  };

  // Initial load + SSE
  useEffect(() => {
    let isMounted = true;
    const ac = new AbortController();

    // Initial fetch
    axios
      .get<string[]>(`${API_BASE}/logs?tail=${pageSize}`, { signal: ac.signal })
      .then((res) => {
        if (!isMounted) return;
        const mapped = res.data.map((text) => ({ id: idRef.current++, text }));
        setEntries(mapped);
        setCurrentPage(1);
      })
      .catch(() => {});

    // SSE
    const es = new EventSource(`${API_BASE}/logs/stream`);
    eventSourceRef.current = es;

    es.onopen = () => isMounted && setIsConnected(true);
    es.onerror = () => isMounted && setIsConnected(false);
    es.onmessage = (ev) => {
      if (!isMounted || paused) return;
      bufferRef.current.push({ id: idRef.current++, text: ev.data });
      scheduleFlush();
      // Auto-follow only when on last page
      if (isOnLastPage) {
        setCurrentPage((p) => Math.max(1, Math.ceil((entries.length + bufferRef.current.length) / pageSize)));
      }
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
  }, [pageSize, paused]);

  // When page size changes, keep on last page
  useEffect(() => {
    setCurrentPage(Math.max(1, Math.ceil(entries.length / pageSize)));
  }, [pageSize, entries.length]);

  const goToLatest = () => setCurrentPage(Math.max(1, Math.ceil(entries.length / pageSize)));
  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  // Controls
  const Controls = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="px-3 py-1 bg-[#0f8a5f] text-white rounded disabled:opacity-50"
        >
          Prev
        </button>
        <div className="text-gray-300 text-sm">
          Page <span className="font-semibold">{currentPage}</span> / {totalPages}
        </div>
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 bg-[#0f8a5f] text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">Page size</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
          className="bg-black/40 border border-gray-700 text-white rounded px-2 py-1"
        >
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={300}>300</option>
          <option value={500}>500</option>
        </select>
      </div>

      <button
        onClick={goToLatest}
        className="px-3 py-1 bg-[#ffd700] text-[#1a0f0f] rounded"
      >
        Latest
      </button>

      <button
        onClick={() => setPaused((v) => !v)}
        className={`px-3 py-1 rounded border ${paused ? "border-red-500 text-red-400" : "border-gray-600 text-gray-300"}`}
      >
        {paused ? "Resume" : "Pause"}
      </button>

      {!isOnLastPage && entries.length > 0 && (
        <button
          onClick={goToLatest}
          className="px-3 py-1 bg-[#0f8a5f] text-white rounded"
        >
          {Math.max(0, entries.length - currentPage * pageSize)} new
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-[#1a0f0f] border-2 border-[#0f8a5f] rounded-xl p-6 h-full flex flex-col backdrop-blur-sm shadow-[0_0_20px_rgba(15,138,95,0.2)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Server Logs</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"} shadow-lg`} />
            <span className="text-sm text-gray-400 font-medium">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          {Controls}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-black rounded-lg p-4 font-mono text-sm border border-gray-800 shadow-inner">
        {entries.length === 0 ? (
          <div className="text-gray-500">No logs available</div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div layout>
              {pageSlice.map((entry) => (
                <LogLine key={entry.id} entry={entry} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

