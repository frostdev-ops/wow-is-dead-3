import { useState, useMemo } from 'react';
import { Search, X, Filter } from 'lucide-react';
import Fuse from 'fuse.js';
import './SearchBar.css';

interface SearchBarProps<T> {
  items: T[];
  onFilteredChange: (filtered: T[]) => void;
  searchKeys: string[];
  placeholder?: string;
  filters?: {
    label: string;
    key: string;
    options: { label: string; value: string }[];
  }[];
}

export default function SearchBar<T extends Record<string, any>>({
  items,
  onFilteredChange,
  searchKeys,
  placeholder = 'Search...',
  filters = [],
}: SearchBarProps<T>) {
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Fuzzy search with Fuse.js
  const fuse = useMemo(() => {
    return new Fuse(items, {
      keys: searchKeys,
      threshold: 0.3,
      includeScore: true,
    });
  }, [items, searchKeys]);

  // Apply search and filters
  useMemo(() => {
    let result = items;

    // Apply search query
    if (query.trim()) {
      result = fuse.search(query).map(r => r.item);
    }

    // Apply filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => {
          const itemValue = item[key];
          if (typeof itemValue === 'string') {
            return itemValue.toLowerCase().includes(value.toLowerCase());
          }
          return itemValue === value;
        });
      }
    });

    onFilteredChange(result);
  }, [query, activeFilters, items, fuse, onFilteredChange]);

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setActiveFilters({});
    setQuery('');
  };

  const hasActiveFilters = query || Object.values(activeFilters).some(v => v);

  // Save search to history
  const saveSearchHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const history = JSON.parse(localStorage.getItem('search_history') || '[]');
    const newHistory = [searchQuery, ...history.filter((q: string) => q !== searchQuery)].slice(0, 10);
    localStorage.setItem('search_history', JSON.stringify(newHistory));
  };

  const handleSearchSubmit = () => {
    saveSearchHistory(query);
  };

  return (
    <div className="search-bar">
      <div className="search-bar-input-wrapper">
        <Search size={18} className="search-bar-icon" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
          placeholder={placeholder}
          className="search-bar-input"
        />
        {hasActiveFilters && (
          <button onClick={clearFilters} className="search-bar-clear" title="Clear filters">
            <X size={16} />
          </button>
        )}
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`search-bar-filter-btn ${showFilters ? 'active' : ''}`}
            title="Show filters"
          >
            <Filter size={16} />
          </button>
        )}
      </div>

      {showFilters && filters.length > 0 && (
        <div className="search-bar-filters">
          {filters.map((filter) => (
            <div key={filter.key} className="search-bar-filter-group">
              <label className="search-bar-filter-label">{filter.label}</label>
              <select
                value={activeFilters[filter.key] || ''}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                className="search-bar-filter-select"
              >
                <option value="">All</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {query && (
        <div className="search-bar-results-count">
          Found {items.length} {items.length === 1 ? 'item' : 'items'}
        </div>
      )}
    </div>
  );
}
