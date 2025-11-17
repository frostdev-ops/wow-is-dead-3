import React, { useEffect, useRef, useState } from "react";
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
      // When user scrolls back to bottom, ensure we're exactly at the end
      requestAnimationFrame(() => {
        if (autoFollowRef.current) {
          jumpToBottom(false);
        }
      });
    }
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      const buffered = bufferRef.current;
      if (buffered.length === 0) return;

      const wasAtBottom = autoFollowRef.current;

      setEntries((prev) => {
        const merged = [...prev, ...buffered];
        bufferRef.current = [];
        // Cap lines to keep memory bounded
        const trimmed =
          merged.length > MAX_LINES ? merged.slice(merged.length - MAX_LINES) : merged;

        // If user isn't at bottom, track pending count
        if (!wasAtBottom) {
          const added = merged.length - prev.length;
          setPendingCount((c) => c + added);
        }

        return trimmed;
      });

      // Auto-scroll to new logs if user was at the bottom
      // Use requestAnimationFrame to ensure DOM has updated
      if (wasAtBottom) {
        requestAnimationFrame(() => {
          // Double-check we're still at bottom (user might have scrolled)
          if (autoFollowRef.current) {
            jumpToBottom(true);
          }
        });
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
        // Start scrolled to bottom on first load and enable auto-follow
        autoFollowRef.current = true;
        requestAnimationFrame(() => {
          jumpToBottom(false);
          // Ensure we're at bottom after initial load
          setTimeout(() => {
            if (isMounted && autoFollowRef.current) {
              jumpToBottom(false);
            }
          }, 100);
        });
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
    // Ensure we stay at bottom after jumping
    requestAnimationFrame(() => {
      if (autoFollowRef.current) {
        jumpToBottom(false);
      }
    });
  };

  return (
    <div className="bg-[#1a0f0f] border-2 border-[#0f8a5f] rounded-xl p-6 flex flex-col backdrop-blur-sm shadow-[0_0_20px_rgba(15,138,95,0.2)]">
      <div className="flex items-center justify-between mb-4 flex-shrink-0 pb-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">Server Logs</h2>
          <span className="text-xs text-gray-500 font-mono bg-gray-900/50 px-2 py-1 rounded border border-gray-800">
            {entries.length} lines
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-lg border border-gray-800">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse shadow-lg shadow-green-500/50" : "bg-red-500 shadow-lg shadow-red-500/50"
              }`}
            />
            <span className="text-xs text-gray-400 font-medium">
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
          {pendingCount > 0 && !autoFollowRef.current && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handleJumpToLatest}
              className="px-4 py-1.5 rounded-lg bg-[#0f8a5f] text-white font-medium hover:bg-[#0c6b4a] transition-all shadow-lg shadow-[#0f8a5f]/30 hover:shadow-[#0f8a5f]/50 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {pendingCount} new
            </motion.button>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="overflow-y-auto bg-gradient-to-b from-black via-gray-950 to-black rounded-lg border border-gray-800 shadow-inner relative"
        style={{ 
          willChange: "transform",
          height: "600px",
          maxHeight: "70vh"
        }}
      >
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        />
        
        {entries.length === 0 ? (
          <div className="text-gray-500 p-4 text-center">No logs available</div>
        ) : (
          <motion.div layout="position" className="relative z-10">
            <AnimatePresence initial={false}>
              {entries.map((entry, index) => {
                const { className, bgClassName } = formatLogLine(entry.text);
                const timestamp = extractTimestamp(entry.text);
                const lineNumber = index + 1;
                
                return (
                  <motion.div
                    key={entry.id}
                    layout="position"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className={`group px-4 py-1.5 ${bgClassName} hover:bg-opacity-30 transition-colors duration-150 border-b border-gray-800/30`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Line number */}
                      <span className="text-gray-600 text-xs font-mono select-none flex-shrink-0 min-w-[3rem] text-right group-hover:text-gray-500 transition-colors">
                        {lineNumber.toString().padStart(4, '0')}
                      </span>
                      
                      {/* Timestamp */}
                      {timestamp && (
                        <span className="text-gray-500 text-xs font-mono flex-shrink-0 min-w-[4rem]">
                          {timestamp}
                        </span>
                      )}
                      
                      {/* Log content */}
                      <span className={`${className} whitespace-pre-wrap break-words flex-1 font-mono text-[13px] leading-relaxed`}>
                        {highlightSyntax(entry.text)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
        <div ref={endRef} className="h-2" />
      </div>
    </div>
  );
}

function formatLogLine(line: string): { className: string; bgClassName: string } {
  const lowerLine = line.toLowerCase();
  
  // Command logs
  if (line.includes("[CMD]")) {
    return { 
      className: "text-yellow-300 font-semibold", 
      bgClassName: "bg-yellow-900/20 border-l-2 border-yellow-500/50" 
    };
  }
  
  // Error logs
  if (lowerLine.includes("error") || line.includes("[STDERR]")) {
    return { 
      className: "text-red-300 font-medium", 
      bgClassName: "bg-red-900/15 border-l-2 border-red-500/50" 
    };
  }
  
  // Warning logs
  if (lowerLine.includes("warn") || lowerLine.includes("warning")) {
    return { 
      className: "text-yellow-400 font-medium", 
      bgClassName: "bg-yellow-900/10 border-l-2 border-yellow-500/30" 
    };
  }
  
  // Success/Info logs
  if (lowerLine.includes("done") || lowerLine.includes("success") || lowerLine.includes("loaded")) {
    return { 
      className: "text-green-300", 
      bgClassName: "bg-green-900/10 border-l-2 border-green-500/30" 
    };
  }
  
  // Info/STDOUT logs
  if (line.includes("[STDOUT]") || lowerLine.includes("info")) {
    return { 
      className: "text-blue-300", 
      bgClassName: "bg-blue-900/10 border-l-2 border-blue-500/20" 
    };
  }
  
  // Debug logs
  if (lowerLine.includes("debug") || lowerLine.includes("[debug]")) {
    return { 
      className: "text-purple-300", 
      bgClassName: "bg-purple-900/10 border-l-2 border-purple-500/20" 
    };
  }
  
  // Default
  return { 
    className: "text-gray-300", 
    bgClassName: "bg-gray-900/5 border-l-2 border-gray-700/20" 
  };
}

function extractTimestamp(line: string): string | null {
  // Try to extract Minecraft-style timestamps like [12:34:56] or [HH:mm:ss]
  const timestampMatch = line.match(/\[(\d{2}:\d{2}:\d{2})\]/);
  if (timestampMatch) {
    return timestampMatch[1];
  }
  // Try ISO timestamp
  const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (isoMatch) {
    return isoMatch[1].split('T')[1].split('.')[0]; // Extract time part only
  }
  return null;
}

function highlightSyntax(line: string): React.ReactElement {
  const parts: React.ReactElement[] = [];
  let lastIndex = 0;
  
  // Highlight URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  while ((match = urlRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{line.substring(lastIndex, match.index)}</span>);
    }
    parts.push(
      <span key={match.index} className="text-blue-400 underline hover:text-blue-300">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < line.length) {
    parts.push(<span key={lastIndex}>{line.substring(lastIndex)}</span>);
  }
  
  return parts.length > 0 ? <>{parts}</> : <>{line}</>;
}

