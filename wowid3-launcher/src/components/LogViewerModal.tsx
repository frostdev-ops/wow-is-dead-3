import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { useToast } from './ui/ToastContainer';
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
  const [isStoppingGame, setIsStoppingGame] = useState(false);
  const [isKillingGame, setIsKillingGame] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logPollingRef = useRef<number | null>(null);
  const logsRef = useRef<LogLine[]>([]);
  const gameDir = useSettingsStore((state) => state.gameDirectory);
  const { addToast } = useToast();

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
      console.log('[LogViewer] Loading logs...');
      console.log('[LogViewer] gameDir value:', gameDir);
      console.log('[LogViewer] gameDir type:', typeof gameDir);
      console.log('[LogViewer] gameDir defined?', gameDir !== undefined && gameDir !== null);

      if (!gameDir) {
        console.error('[LogViewer] gameDir is not set!');
        return;
      }

      setLoading(true);
      const logLines = await invoke<string[]>('cmd_read_latest_log', {
        gameDir: gameDir,
        lines: 500,
      });
      console.log('[LogViewer] Received log lines:', logLines?.length || 0);
      if (logLines && logLines.length > 0) {
        console.log('[LogViewer] First few lines:', logLines.slice(0, 3));
      }
      const parsedLogs = logLines.map(parseLogLine);
      logsRef.current = parsedLogs;
      setLogs(parsedLogs);
      console.log('[LogViewer] Set logs state, count:', parsedLogs.length);
    } catch (error) {
      console.error('[LogViewer] Failed to load logs:', error);
      console.error('[LogViewer] Error type:', typeof error);
      console.error('[LogViewer] Error details:', JSON.stringify(error, null, 2));
      addToast(`Failed to load logs: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [gameDir, addToast]);

  // Check if game is running
  const checkGameStatus = useCallback(async () => {
    try {
      console.log('[LogViewer] Checking game status...');
      const running = await invoke<boolean>('cmd_is_game_running');
      console.log('[LogViewer] Game status result:', running);
      setIsGameRunning((prevRunning) => {
        if (prevRunning !== running) {
          console.log('[LogViewer] Game status CHANGED:', running ? 'running' : 'stopped');
        }
        return running;
      });
      // Don't stop polling when game stops - we still want to show historical logs
    } catch (error) {
      console.error('[LogViewer] Failed to check game status:', error);
      setIsGameRunning(false);
    }
  }, []);

  // Poll for new logs
  const startLogPolling = useCallback(() => {
    if (logPollingRef.current) {
      console.log('[LogViewer] Clearing existing polling interval');
      clearInterval(logPollingRef.current);
    }

    console.log('[LogViewer] Starting log polling with gameDir:', gameDir);
    let pollCount = 0;

    logPollingRef.current = setInterval(async () => {
      pollCount++;
      try {
        if (!gameDir) {
          console.warn('[LogViewer] Poll #' + pollCount + ': gameDir not set, skipping');
          return;
        }

        const currentLineCount = logsRef.current.length;
        console.log('[LogViewer] Poll #' + pollCount + ': Checking for new logs (known lines:', currentLineCount + ')');

        const newLines = await invoke<string[]>('cmd_get_new_log_lines', {
          gameDir: gameDir,
          knownLineCount: currentLineCount,
        });

        console.log('[LogViewer] Poll #' + pollCount + ': Received', newLines?.length || 0, 'new lines');

        if (newLines && newLines.length > 0) {
          console.log('[LogViewer] Poll #' + pollCount + ': Adding new log lines to display');
          const parsedNewLines = newLines.map(parseLogLine);
          const updatedLogs = [...logsRef.current, ...parsedNewLines];
          logsRef.current = updatedLogs;
          setLogs(updatedLogs);
        }

        // Check if game is still running
        await checkGameStatus();
      } catch (error) {
        console.error('[LogViewer] Poll #' + pollCount + ': Error polling logs:', error);
      }
    }, 1000); // Increased to 1 second to reduce console spam
  }, [gameDir, checkGameStatus]);

  // Initialize on mount
  useEffect(() => {
    if (!isOpen) {
      // Clear logs when modal closes
      logsRef.current = [];
      setLogs([]);
      if (logPollingRef.current) {
        clearInterval(logPollingRef.current);
        logPollingRef.current = null;
      }
      return;
    }

    console.log('[LogViewer] Modal opened, loading logs...');

    // Clear old logs and reload fresh
    logsRef.current = [];
    setLogs([]);
    setLoading(true);

    // Load logs
    loadLogs();

    // Check game status
    checkGameStatus();

    // Start polling
    startLogPolling();

    return () => {
      if (logPollingRef.current) {
        clearInterval(logPollingRef.current);
        logPollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only depend on isOpen to prevent infinite loops

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
      setIsStoppingGame(true);
      await invoke('cmd_stop_game');
      addToast('Game stopped successfully', 'success');

      // Wait a moment for process to stop, then refresh status
      setTimeout(async () => {
        await checkGameStatus();
      }, 500);
    } catch (error) {
      console.error('Failed to stop game:', error);
      addToast(`Failed to stop game: ${error}`, 'error');
    } finally {
      setIsStoppingGame(false);
    }
  };

  // Kill game forcefully
  const handleKillGame = async () => {
    try {
      setIsKillingGame(true);
      await invoke('cmd_kill_game');
      addToast('Game killed successfully', 'success');

      // Wait a moment for process to terminate, then refresh status
      setTimeout(async () => {
        await checkGameStatus();
      }, 500);
    } catch (error) {
      console.error('Failed to kill game:', error);
      addToast(`Failed to kill game: ${error}`, 'error');
    } finally {
      setIsKillingGame(false);
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
                      disabled={isStoppingGame || isKillingGame}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isStoppingGame ? (
                        <>
                          <div className="animate-spin">◌</div>
                          Stopping...
                        </>
                      ) : (
                        <>
                          <Square size={16} />
                          Stop Game
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleKillGame}
                      disabled={isStoppingGame || isKillingGame}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isKillingGame ? (
                        <>
                          <div className="animate-spin">◌</div>
                          Killing...
                        </>
                      ) : (
                        <>
                          <Zap size={16} />
                          Kill
                        </>
                      )}
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
