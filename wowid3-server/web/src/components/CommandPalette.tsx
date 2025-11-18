import { useState, useEffect, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Search, Command, X, FileText, Folder, Plus, Trash2, Download, Upload, RefreshCw } from 'lucide-react';
import Fuse from 'fuse.js';
import './CommandPalette.css';

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

  if (!isOpen) return null;

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-header">
          <Search size={20} className="command-palette-search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            className="command-palette-input"
            autoFocus
          />
          <button onClick={onClose} className="command-palette-close">
            <X size={18} />
          </button>
        </div>

        <div className="command-palette-results">
          {filteredCommands.length === 0 && (
            <div className="command-palette-empty">
              <p>No commands found</p>
              <p style={{ fontSize: '12px', opacity: 0.7 }}>Try a different search term</p>
            </div>
          )}

          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="command-palette-category">
              <div className="command-palette-category-title">{category}</div>
              {cmds.map((cmd, idx) => {
                const globalIndex = filteredCommands.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    className={`command-palette-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                  >
                    {cmd.icon && <span className="command-palette-item-icon">{cmd.icon}</span>}
                    <div className="command-palette-item-content">
                      <div className="command-palette-item-name">{cmd.name}</div>
                      {cmd.description && (
                        <div className="command-palette-item-description">{cmd.description}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="command-palette-footer">
          <div className="command-palette-hint">
            <span className="command-palette-key">↑↓</span> Navigate
            <span className="command-palette-key">Enter</span> Execute
            <span className="command-palette-key">Esc</span> Close
          </div>
        </div>
      </div>
    </div>
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
