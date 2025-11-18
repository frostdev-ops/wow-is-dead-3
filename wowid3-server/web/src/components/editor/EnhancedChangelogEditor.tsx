import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Eye, Code, FileText, Sparkles, Plus } from 'lucide-react';
import './EnhancedChangelogEditor.css';

interface EnhancedChangelogEditorProps {
  value: string;
  onChange: (value: string) => void;
  onGenerateChangelog?: () => void;
}

const CHANGELOG_TEMPLATES = [
  {
    name: 'Feature Release',
    icon: <Sparkles size={14} />,
    template: `## What's New

### Features
- ✨ Added new feature X
- ✨ Introduced functionality Y

### Improvements
- 🚀 Enhanced performance of Z
- 🎨 Improved UI/UX for A

### Bug Fixes
- 🐛 Fixed issue with B
- 🐛 Resolved problem in C

### Technical
- 🔧 Updated dependencies
- 📦 Optimized build process
`,
  },
  {
    name: 'Bug Fix Release',
    icon: <FileText size={14} />,
    template: `## Bug Fixes

### Critical
- 🔥 Fixed critical bug causing X
- 🔥 Resolved crash in Y

### High Priority
- 🐛 Fixed issue where Z happens
- 🐛 Corrected behavior of A

### Minor
- 🔧 Small fix for B
- 🔧 Adjusted C
`,
  },
  {
    name: 'Breaking Changes',
    icon: <Code size={14} />,
    template: `## ⚠️ Breaking Changes

### What Changed
- **BREAKING**: X has been renamed to Y
- **BREAKING**: Z now requires A

### Migration Guide
1. Update your configuration files
2. Replace old API calls with new ones
3. Test your setup

### Additional Changes
- Added new B feature
- Improved C performance
`,
  },
  {
    name: 'Modpack Update',
    icon: <Plus size={14} />,
    template: `## Modpack Update - Version X.X.X

### Added Mods
- 🎮 **Mod Name** - Description of what it adds

### Updated Mods
- 🔄 **Mod Name** (vOld → vNew) - What changed

### Removed Mods
- ❌ **Mod Name** - Reason for removal

### Configuration Changes
- Adjusted X settings
- Enabled Y feature
- Disabled Z for compatibility

### Known Issues
- Issue A (workaround: do B)
`,
  },
];

export default function EnhancedChangelogEditor({
  value,
  onChange,
  onGenerateChangelog,
}: EnhancedChangelogEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [showTemplates, setShowTemplates] = useState(false);

  const handleTemplateSelect = (template: string) => {
    if (value.trim() && !confirm('This will replace your current changelog. Continue?')) {
      return;
    }
    onChange(template);
    setShowTemplates(false);
  };

  const insertEmoji = (emoji: string) => {
    // Insert emoji at cursor position (simple version - appends to end)
    onChange(value + emoji);
  };

  const commonEmojis = ['✨', '🐛', '🚀', '🎨', '🔥', '📦', '🔧', '⚠️', '✅', '❌', '🎮', '🔄'];

  return (
    <div className="enhanced-changelog-editor">
      <div className="enhanced-changelog-toolbar">
        <div className="enhanced-changelog-toolbar-group">
          <button
            className={`toolbar-btn ${viewMode === 'edit' ? 'active' : ''}`}
            onClick={() => setViewMode('edit')}
            title="Edit Mode"
          >
            <Code size={16} /> Edit
          </button>
          <button
            className={`toolbar-btn ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
            title="Preview Mode"
          >
            <Eye size={16} /> Preview
          </button>
          <button
            className={`toolbar-btn ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            title="Split Mode"
          >
            <FileText size={16} /> Split
          </button>
        </div>

        <div className="enhanced-changelog-toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => setShowTemplates(!showTemplates)}
            title="Insert Template"
          >
            <Plus size={16} /> Template
          </button>
          {onGenerateChangelog && (
            <button
              className="toolbar-btn"
              onClick={onGenerateChangelog}
              title="Generate from file changes"
            >
              <Sparkles size={16} /> Auto-Generate
            </button>
          )}
        </div>

        <div className="enhanced-changelog-toolbar-group">
          {commonEmojis.map((emoji) => (
            <button
              key={emoji}
              className="toolbar-btn emoji-btn"
              onClick={() => insertEmoji(emoji)}
              title={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {showTemplates && (
        <div className="changelog-templates">
          <div className="changelog-templates-header">
            <h4>Changelog Templates</h4>
            <button onClick={() => setShowTemplates(false)} className="btn-close">
              ×
            </button>
          </div>
          <div className="changelog-templates-grid">
            {CHANGELOG_TEMPLATES.map((template) => (
              <button
                key={template.name}
                className="changelog-template-card"
                onClick={() => handleTemplateSelect(template.template)}
              >
                <div className="changelog-template-icon">{template.icon}</div>
                <div className="changelog-template-name">{template.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`enhanced-changelog-content view-${viewMode}`}>
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className="enhanced-changelog-editor-pane">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Write your changelog here... Use Markdown formatting!"
              className="enhanced-changelog-textarea"
              spellCheck={false}
            />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="enhanced-changelog-preview-pane">
            <div className="markdown-preview">
              {value.trim() ? (
                <ReactMarkdown>{value}</ReactMarkdown>
              ) : (
                <div className="markdown-preview-empty">
                  <p>Preview will appear here</p>
                  <p style={{ fontSize: '12px', opacity: 0.7 }}>
                    Start typing or select a template to see the preview
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="enhanced-changelog-footer">
        <span>Characters: {value.length}</span>
        <span>Lines: {value.split('\n').length}</span>
        <span>Markdown supported</span>
      </div>
    </div>
  );
}
