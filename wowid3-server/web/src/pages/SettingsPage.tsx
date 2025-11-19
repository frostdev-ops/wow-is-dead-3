import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBlacklistQuery, useUpdateBlacklistMutation } from '@/hooks/queries';
import { Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';

export default function SettingsPage() {
  const blacklistQuery = useBlacklistQuery();
  const updateBlacklistMutation = useUpdateBlacklistMutation();

  const [blacklistPatterns, setBlacklistPatterns] = useState<string[]>([]);
  const [newPattern, setNewPattern] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync blacklist patterns with query data
  useEffect(() => {
    if (blacklistQuery.data) {
      setBlacklistPatterns(blacklistQuery.data);
    }
  }, [blacklistQuery.data]);

  const handleAddPattern = () => {
    if (newPattern.trim() && !blacklistPatterns.includes(newPattern.trim())) {
      setBlacklistPatterns([...blacklistPatterns, newPattern.trim()]);
      setNewPattern('');
      setMessage(null);
    }
  };

  const handleRemovePattern = (pattern: string) => {
    setBlacklistPatterns(blacklistPatterns.filter((p) => p !== pattern));
    setMessage(null);
  };

  const handleSave = () => {
    updateBlacklistMutation.mutate(blacklistPatterns, {
      onSuccess: () => {
        setMessage({ type: 'success', text: 'Blacklist updated successfully!' });
      },
      onError: (error: any) => {
        setMessage({ type: 'error', text: error.message || 'Failed to save blacklist' });
      },
    });
  };

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-2xl">
        <Card className="p-6">
        <h2 className="text-2xl font-bold mb-2">Blacklist Settings</h2>
        <p className="text-muted-foreground mb-6">
          Configure file patterns to exclude from modpack updates. These files won't be included in manifest generation.
        </p>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex gap-3 ${
              message.type === 'success'
                ? 'bg-success/10 border border-success/30'
                : 'bg-destructive/10 border border-destructive/30'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            )}
            <p
              className={
                message.type === 'success'
                  ? 'text-success'
                  : 'text-destructive'
              }
            >
              {message.text}
            </p>
          </div>
        )}

        {/* Add Pattern Form */}
        <div className="mb-6 space-y-3">
          <label className="block text-sm font-medium">Add Blacklist Pattern</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., *.txt, config/**, saves/**"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddPattern()}
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button onClick={handleAddPattern} variant="default" className="flex gap-2">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Supports glob patterns: <code className="bg-accent px-1 py-0.5 rounded">*.txt</code> (files),{' '}
            <code className="bg-accent px-1 py-0.5 rounded">config/**</code> (directories)
          </p>
        </div>

        {/* Patterns List */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">Active Patterns ({blacklistPatterns.length})</label>
          {blacklistPatterns.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">No patterns added yet</p>
          ) : (
            <div className="space-y-2">
              {blacklistPatterns.map((pattern) => (
                <div key={pattern} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <code className="text-sm font-mono">{pattern}</code>
                  <Button
                    onClick={() => handleRemovePattern(pattern)}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={updateBlacklistMutation.isPending}
            className="flex-1"
          >
            {updateBlacklistMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            onClick={() => {
              if (blacklistQuery.data) {
                setBlacklistPatterns(blacklistQuery.data);
              }
              setMessage(null);
            }}
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Help Section */}
      <Card className="p-6 bg-muted/30 border-border">
        <h3 className="font-semibold mb-3">Common Patterns</h3>
        <div className="space-y-2 text-sm">
          <p>
            <code className="bg-background px-2 py-1 rounded">*.txt</code> - Exclude all text files
          </p>
          <p>
            <code className="bg-background px-2 py-1 rounded">config/**</code> - Exclude entire config directory
          </p>
          <p>
            <code className="bg-background px-2 py-1 rounded">saves/**</code> - Exclude player save data
          </p>
          <p>
            <code className="bg-background px-2 py-1 rounded">*.json</code> - Exclude all JSON files
          </p>
        </div>
      </Card>
      </div>
    </PageTransition>
  );
}
