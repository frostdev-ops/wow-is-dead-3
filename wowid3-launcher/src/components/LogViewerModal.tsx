import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { useToast } from './ui/ToastContainer';
import { ChevronDown, X, Square, Zap, AlertCircle, Filter } from 'lucide-react';

interface LogLine {
  raw: string;
  timestamp?: string;
  level?: string;
  source?: string;
  message?: string;
}

interface LogResult {
  lines: string[];
  start_offset: number;
  end_offset: number;
  total_size: number;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [isStoppingGame, setIsStoppingGame] = useState(false);
  const [isKillingGame, setIsKillingGame] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(['INFO', 'WARN', 'ERROR', 'DEBUG', 'FATAL']));
  const [showFilters, setShowFilters] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logPollingRef = useRef<number | null>(null);
  const logsRef = useRef<LogLine[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gameDir = useSettingsStore((state) => state.gameDirectory);
  const { addToast } = useToast();

  // Track file offsets for efficient loading
  const startOffsetRef = useRef<number>(0);
  const endOffsetRef = useRef<number>(0);
  const totalSizeRef = useRef<number>(0);

  // Available log levels
  const LOG_LEVELS = ['INFO', 'WARN', 'WARNING', 'ERROR', 'FATAL', 'DEBUG'];

  // Toggle log level filter
  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) => {
      const newLevels = new Set(prev);
      if (newLevels.has(level)) {
        newLevels.delete(level);
      } else {
        newLevels.add(level);
      }
      return newLevels;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedLevels(new Set(LOG_LEVELS));
  };

  // Toggle all log levels
  const toggleAllLevels = () => {
    if (selectedLevels.size === LOG_LEVELS.length) {
      setSelectedLevels(new Set());
    } else {
      setSelectedLevels(new Set(LOG_LEVELS));
    }
  };

  // Filter logs based on search and level filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by log level
      if (log.level && !selectedLevels.has(log.level)) {
        return false;
      }

      // Filter by search term
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        return (
          log.raw.toLowerCase().includes(searchLower) ||
          log.message?.toLowerCase().includes(searchLower) ||
          log.source?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [logs, searchTerm, selectedLevels]);

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

  // Load initial logs (tail)
  const loadLogs = useCallback(async () => {
    try {
      console.log('[LogViewer] Loading logs...');
      
      if (!gameDir) {
        console.error('[LogViewer] gameDir is not set!');
        return;
      }

      setLoading(true);
      // Use new efficient tail reading command
      const result = await invoke<LogResult>('cmd_read_log_tail', {
        gameDir: gameDir,
        lines: 500,
      });
      
      console.log('[LogViewer] Received log result:', result.lines.length, 'lines');
      
      // Update offsets
      startOffsetRef.current = result.start_offset;
      endOffsetRef.current = result.end_offset;
      totalSizeRef.current = result.total_size;
      
      const parsedLogs = result.lines.map(parseLogLine);
      logsRef.current = parsedLogs;
      setLogs(parsedLogs);
    } catch (error) {
      console.error('[LogViewer] Failed to load logs:', error);
      addToast(`Failed to load logs: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [gameDir, addToast]);

  // Load older logs (scroll up)
  const loadOlderLogs = useCallback(async () => {
    if (loadingMore || startOffsetRef.current <= 0 || !gameDir) return;
    
    try {
      setLoadingMore(true);
      console.log('[LogViewer] Loading older logs before offset:', startOffsetRef.current);
      
      const result = await invoke<LogResult>('cmd_read_log_before_offset', {
        gameDir: gameDir,
        endOffset: startOffsetRef.current,
        lines: 500,
      });
      
      if (result.lines.length > 0) {
        console.log('[LogViewer] Loaded', result.lines.length, 'older lines');
        
        // Update start offset
        startOffsetRef.current = result.start_offset;
        
        const parsedLogs = result.lines.map(parseLogLine);
        
        // Prepend to existing logs
        const updatedLogs = [...parsedLogs, ...logsRef.current];
        logsRef.current = updatedLogs;
        setLogs(updatedLogs);
        
        // Maintain scroll position
        // This is tricky in React, usually handled by layout effect or ref manipulation
        // For now, we let the user scroll, but we might need to adjust scrollTop
        if (logsContainerRef.current) {
           // We need to adjust scroll position to prevent jumping
           // But since we are prepending, the content height increases
           // The browser might handle this or we might need to manually adjust
           // Ideally we capture scrollHeight before update and adjust scrollTop after
           const oldScrollHeight = logsContainerRef.current.scrollHeight;
           const oldScrollTop = logsContainerRef.current.scrollTop;
           
           // We need to wait for render to update scroll position
           requestAnimationFrame(() => {
             if (logsContainerRef.current) {
               const newScrollHeight = logsContainerRef.current.scrollHeight;
               const heightDifference = newScrollHeight - oldScrollHeight;
               logsContainerRef.current.scrollTop = oldScrollTop + heightDifference;
             }
           });
        }
      }
    } catch (error) {
      console.error('[LogViewer] Failed to load older logs:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [gameDir, loadingMore]);

  // Check if game is running
  const checkGameStatus = useCallback(async () => {
    try {
      const running = await invoke<boolean>('cmd_is_game_running');
      setIsGameRunning((prevRunning) => {
        if (prevRunning !== running) {
          console.log('[LogViewer] Game status CHANGED:', running ? 'running' : 'stopped');
        }
        return running;
      });
    } catch (error) {
      console.error('[LogViewer] Failed to check game status:', error);
      setIsGameRunning(false);
    }
  }, []);

  // Poll for new logs
  const startLogPolling = useCallback(() => {
    if (logPollingRef.current) {
      clearInterval(logPollingRef.current);
    }

    console.log('[LogViewer] Starting log polling with gameDir:', gameDir);
    let pollCount = 0;

    logPollingRef.current = setInterval(async () => {
      pollCount++;
      try {
        if (!gameDir) return;

        // Use efficient offset-based polling
        const result = await invoke<LogResult>('cmd_read_log_from_offset', {
          gameDir: gameDir,
          startOffset: endOffsetRef.current,
        });

        if (result.lines.length > 0) {
          console.log('[LogViewer] Poll #' + pollCount + ': Received', result.lines.length, 'new lines');
          
          // Update end offset
          endOffsetRef.current = result.end_offset;
          totalSizeRef.current = result.total_size;
          
          const parsedNewLines = result.lines.map(parseLogLine);
          const updatedLogs = [...logsRef.current, ...parsedNewLines];
          
          // Limit total logs in memory if needed, but since we paginate upwards, 
          // we might want to keep them or implement virtual scrolling.
          // For now, let's keep them as user might want to see history they just scrolled through.
          // But if it gets too large (> 5000 lines), we might want to trim from top if user is at bottom.
          
          if (updatedLogs.length > 5000 && isScrolledToBottom) {
             // If we have too many logs and are at bottom, trim top to save memory
             // But this breaks "scroll up" continuity if we trim what we just loaded.
             // Let's just keep it simple for now. The main issue was loading 100MB at once.
             // Appending small chunks is fine.
          }
          
          logsRef.current = updatedLogs;
          setLogs(updatedLogs);
        }

        // Check if game is still running
        await checkGameStatus();
      } catch (error) {
        console.error('[LogViewer] Poll #' + pollCount + ': Error polling logs:', error);
      }
    }, 1000) as any;
  }, [gameDir, checkGameStatus, isScrolledToBottom]);

  // Initialize on mount
  useEffect(() => {
    if (!isOpen) {
      // Clear logs when modal closes
      logsRef.current = [];
      setLogs([]);
      startOffsetRef.current = 0;
      endOffsetRef.current = 0;
      
      // Reset filters
      setSearchTerm('');
      setSelectedLevels(new Set(LOG_LEVELS));
      setShowFilters(false);
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
    startOffsetRef.current = 0;
    endOffsetRef.current = 0;
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

  // Keyboard shortcut for search (Ctrl+F / Cmd+F)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape to close modal
      if (e.key === 'Escape' && !searchTerm) {
        onClose();
      }
      // Escape to clear search if there's a search term
      if (e.key === 'Escape' && searchTerm) {
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchTerm, onClose]);

  // Detect scroll position
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    setIsScrolledToBottom(isAtBottom);
    
    // Detect scroll to top for infinite scrolling
    if (container.scrollTop < 50 && !loadingMore && startOffsetRef.current > 0) {
      loadOlderLogs();
    }
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

            {/* Search and Filters */}
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-700 space-y-2">
              {/* Search Bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search logs... (Ctrl+F)"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showFilters ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Filter size={16} />
                  Filters
                </button>
                {(searchTerm || selectedLevels.size < LOG_LEVELS.length) && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">Log Levels</span>
                      <button
                        onClick={toggleAllLevels}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        {selectedLevels.size === LOG_LEVELS.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {LOG_LEVELS.map((level) => {
                        const isSelected = selectedLevels.has(level);
                        const colorClass = getLevelColor(level).replace('text-', 'bg-').replace('400', '500/20');
                        const textColorClass = getLevelColor(level);

                        return (
                          <button
                            key={level}
                            onClick={() => toggleLevel(level)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${
                              isSelected
                                ? `${colorClass} ${textColorClass} border-2 border-current opacity-100`
                                : 'bg-transparent text-slate-600 border-2 border-dashed border-slate-700 opacity-50 hover:opacity-75'
                            }`}
                          >
                            {isSelected && <span className="text-[10px]">✓</span>}
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Filter Stats */}
              {(searchTerm || selectedLevels.size < LOG_LEVELS.length) && (
                <div className="text-xs text-slate-400">
                  Showing {filteredLogs.length} of {logs.length} lines
                  {searchTerm && <span className="ml-1">matching "{searchTerm}"</span>}
                </div>
              )}
            </div>

            {/* Content */}
            <div
              ref={logsContainerRef}
              onScroll={handleScroll}
              className="bg-slate-950 overflow-y-auto px-4 py-3 space-y-0"
              style={{ maxHeight: 'calc(80vh - 240px)' }}
            >
              {loadingMore && (
                <div className="flex items-center justify-center py-2 text-slate-500 text-xs">
                  <div className="animate-spin mr-2">◌</div>
                  Loading older logs...
                </div>
              )}
              
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
              ) : filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  <AlertCircle size={20} className="mr-2" />
                  <span>No logs match your filters</span>
                </div>
              ) : (
                filteredLogs.map((log, index) => renderLogLine(log, index))
              )}
            </div>

            {/* Scroll Indicator */}
            {!isScrolledToBottom && filteredLogs.length > 0 && (
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
                {filteredLogs.length !== logs.length ? (
                  <>
                    {filteredLogs.length} / {logs.length} lines • {isGameRunning ? 'Game running' : 'Game stopped'}
                  </>
                ) : (
                  <>
                    {logs.length} lines • {isGameRunning ? 'Game running' : 'Game stopped'}
                  </>
                )}
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
