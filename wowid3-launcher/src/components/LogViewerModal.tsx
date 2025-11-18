import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { ChevronDown, X, Square, Zap, AlertCircle } from 'lucide-react';

interface LogLine {
  raw: string;
  timestamp?: string;
  level?: string;
  source?: string;
  message?: string;
}

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LogViewerModal: React.FC<LogViewerModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logPollingRef = useRef<NodeJS.Timeout | null>(null);
  const gameDir = useSettingsStore((state) => state.gameDirectory);

  // Parse log line with syntax highlighting info
  const parseLogLine = (line: string): LogLine => {
    const parsed: LogLine = { raw: line };

    // Match timestamp [HH:MM:SS]
    const timestampMatch = line.match(/\[(\d{2}:\d{2}:\d{2})\]/);
    if (timestampMatch) {
      parsed.timestamp = timestampMatch[1];
    }

    // Match log level [LEVEL] or [LEVEL/SOURCE]
    const levelMatch = line.match(/\[([A-Z]+)(?:\/([^\]]+))?\]/);
    if (levelMatch) {
      parsed.level = levelMatch[1];
      if (levelMatch[2]) {
        parsed.source = levelMatch[2];
      }
    }

    // Extract message (everything after timestamps and level)
    const messageStart = line.indexOf(': ');
    if (messageStart !== -1) {
      parsed.message = line.substring(messageStart + 2);
    }

    return parsed;
  };

  // Get color for log level
  const getLevelColor = (level?: string): string => {
    switch (level) {
      case 'ERROR':
      case 'FATAL':
        return 'text-red-400';
      case 'WARN':
      case 'WARNING':
        return 'text-yellow-400';
      case 'INFO':
        return 'text-blue-400';
      case 'DEBUG':
        return 'text-gray-400';
      default:
        return 'text-white';
    }
  };

  // Render a single log line with syntax highlighting
  const renderLogLine = (line: LogLine, index: number) => {
    // Detect stack traces
    const isStackTrace = line.raw.trim().startsWith('at ');
    // Detect file paths
    const hasFilePath = /([a-zA-Z]:\\[\w\\/.]+|\/[\w/.]+)/.test(line.raw);
    // Detect exception/error names
    const hasException = /\w+Exception|\w+Error/.test(line.raw);

    return (
      <div key={index} className="font-mono text-sm leading-relaxed break-words">
        <span className="text-gray-500">[{line.timestamp || 'xx:xx:xx'}]</span>
        {' '}
        <span className={`font-semibold ${getLevelColor(line.level)}`}>
          [{line.level || 'INFO'}
          {line.source && <span className="text-cyan-400">/{line.source}</span>}]
        </span>
        {': '}
        {line.message ? (
          <span className={`${isStackTrace ? 'italic text-orange-400' : ''} ${hasException ? 'font-bold text-red-300' : ''}`}>
            {/* Highlight exception names in message */}
            {line.message.split(/(\w+Exception|\w+Error)/).map((part, i) =>
              /Exception|Error/.test(part) ? (
                <span key={i} className="font-bold text-red-300">{part}</span>
              ) : /\/[\w/.]+|[a-zA-Z]:\\[\w\\.]+/.test(part) ? (
                <span key={i} className="underline text-purple-300">{part}</span>
              ) : /\d+/.test(part) ? (
                <span key={i} className="text-green-400">{part}</span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </span>
        ) : (
          <span className="text-white">{line.raw.substring(line.raw.indexOf(']') + 1)}</span>
        )}
      </div>
    );
  };

  // Load initial logs
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const logLines = await invoke<string[]>('cmd_read_latest_log', {
        game_dir: gameDir,
        lines: 500,
      });
      setLogs(logLines.map(parseLogLine));
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  }, [gameDir]);

  // Check if game is running
  const checkGameStatus = useCallback(async () => {
    try {
      const running = await invoke<boolean>('cmd_is_game_running');
      setIsGameRunning(running);
      if (!running) {
        // Stop polling if game is no longer running
        if (logPollingRef.current) {
          clearInterval(logPollingRef.current);
          logPollingRef.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to check game status:', error);
    }
  }, []);

  // Poll for new logs
  const startLogPolling = useCallback(() => {
    if (logPollingRef.current) clearInterval(logPollingRef.current);

    logPollingRef.current = setInterval(async () => {
      try {
        const newLines = await invoke<string[]>('cmd_get_new_log_lines', {
          game_dir: gameDir,
          known_line_count: logs.length,
        });

        if (newLines && newLines.length > 0) {
          setLogs((prevLogs) => [
            ...prevLogs,
            ...newLines.map(parseLogLine),
          ]);
        }

        // Check if game is still running
        await checkGameStatus();
      } catch (error) {
        console.error('Error polling logs:', error);
      }
    }, 500);
  }, [gameDir, logs.length, checkGameStatus]);

  // Initialize on mount
  useEffect(() => {
    if (isOpen) {
      loadLogs();
      checkGameStatus();
      startLogPolling();
    }

    return () => {
      if (logPollingRef.current) {
        clearInterval(logPollingRef.current);
      }
    };
  }, [isOpen, loadLogs, checkGameStatus, startLogPolling]);

  // Auto-scroll to bottom when new logs arrive (smart scroll)
  useEffect(() => {
    if (isScrolledToBottom && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, isScrolledToBottom]);

  // Detect scroll position
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    setIsScrolledToBottom(isAtBottom);
  };

  // Stop game gracefully
  const handleStopGame = async () => {
    try {
      await invoke('cmd_stop_game');
    } catch (error) {
      console.error('Failed to stop game:', error);
    }
  };

  // Kill game forcefully
  const handleKillGame = async () => {
    try {
      await invoke('cmd_kill_game');
    } catch (error) {
      console.error('Failed to kill game:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isGameRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <h2 className="text-lg font-bold text-white">Game Log</h2>
                </div>
                {isGameRunning && (
                  <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                    Running
                  </span>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div
              ref={logsContainerRef}
              onScroll={handleScroll}
              className="bg-slate-950 overflow-y-auto px-4 py-3 space-y-0 rounded-b-2xl"
              style={{ maxHeight: 'calc(80vh - 120px)' }}
            >
              {loading && logs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  <div className="animate-spin">◌</div>
                  <span className="ml-2">Loading logs...</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  <AlertCircle size={20} className="mr-2" />
                  <span>No logs found</span>
                </div>
              ) : (
                logs.map((log, index) => renderLogLine(log, index))
              )}
            </div>

            {/* Scroll Indicator */}
            {!isScrolledToBottom && logs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center py-2 bg-slate-900 border-t border-slate-800"
              >
                <motion.button
                  animate={{ y: [0, 4, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  onClick={() => {
                    if (logsContainerRef.current) {
                      logsContainerRef.current.scrollTop =
                        logsContainerRef.current.scrollHeight;
                    }
                  }}
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ChevronDown size={14} />
                  New logs
                </motion.button>
              </motion.div>
            )}

            {/* Footer with Controls */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-t border-slate-700 rounded-b-2xl">
              <div className="text-xs text-slate-500">
                {logs.length} lines • {isGameRunning ? 'Game running' : 'Game stopped'}
              </div>

              <div className="flex gap-2">
                {isGameRunning && (
                  <>
                    <button
                      onClick={handleStopGame}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm transition-colors font-medium"
                    >
                      <Square size={16} />
                      Stop Game
                    </button>
                    <button
                      onClick={handleKillGame}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm transition-colors font-medium"
                    >
                      <Zap size={16} />
                      Kill
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LogViewerModal;
