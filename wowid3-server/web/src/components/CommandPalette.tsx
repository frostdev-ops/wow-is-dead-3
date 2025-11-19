import { useState, useEffect, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, X, FileText, Folder, Plus, Trash2, Download, Upload, RefreshCw } from 'lucide-react';
import Fuse from 'fuse.js';

export interface Command {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category?: string;
}

interface CommandPaletteProps {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ commands, isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fuzzy search with Fuse.js
  const fuse = useMemo(() => {
    return new Fuse(commands, {
      keys: ['name', 'description', 'keywords', 'category'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [commands]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }
    return fuse.search(query).map(result => result.item);
  }, [query, fuse, commands]);

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Reset query when opening/closing
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selected = document.querySelector('.command-palette-item.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-[2000] pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-card rounded-xl w-[90%] max-w-[600px] max-h-[70vh] flex flex-col shadow-lg border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center px-5 py-4 border-b border-border gap-3">
              <Search size={20} className="text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent border-none outline-none text-foreground text-base placeholder:text-muted-foreground"
                autoFocus
              />
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'hsl(var(--color-muted))' }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="bg-transparent border-none text-muted-foreground cursor-pointer p-1 flex items-center justify-center rounded transition-colors"
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto py-2">
              {filteredCommands.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-10 px-5 text-center text-muted-foreground"
                >
                  <p className="text-base mb-2 text-foreground">No commands found</p>
                  <p className="text-xs opacity-70">Try a different search term</p>
                </motion.div>
              )}

              {Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category} className="mb-2">
                  <div className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </div>
                  {cmds.map((cmd, idx) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <motion.button
                        key={cmd.id}
                        whileHover={{ x: 2 }}
                        transition={{ duration: 0.15 }}
                        className={`command-palette-item flex items-center gap-3 px-5 py-3 bg-transparent border-none w-full text-left cursor-pointer transition-all text-card-foreground border-l-2 ${
                          isSelected
                            ? 'bg-muted border-l-primary'
                            : 'border-l-transparent hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          cmd.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        {cmd.icon && (
                          <span className="flex items-center justify-center text-primary flex-shrink-0">
                            {cmd.icon}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground mb-0.5">
                            {cmd.name}
                          </div>
                          {cmd.description && (
                            <div className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-muted/50 rounded-b-xl">
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    ↑↓
                  </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    Enter
                  </kbd>
                  Execute
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex items-center justify-center bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    Esc
                  </kbd>
                  Close
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to use command palette
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    setIsOpen(true);
  }, { enableOnFormTags: true });

  useHotkeys('escape', () => {
    setIsOpen(false);
  }, { enabled: isOpen });

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}
