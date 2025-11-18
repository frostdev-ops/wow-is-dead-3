import React, { useState } from 'react';
import { useDrafts } from '../../hooks/useDrafts';
import { Sparkles, Check, Package } from 'lucide-react';
import type { DraftRelease, VersionSuggestions } from '../../types/releases';

interface MetadataTabProps {
  draft: DraftRelease;
  onUpdate: (draft: DraftRelease) => void;
}

export default function MetadataTab({ draft, onUpdate }: MetadataTabProps) {
  const { analyzeDraft, loading } = useDrafts();
  const [suggestions, setSuggestions] = useState<VersionSuggestions | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [formData, setFormData] = useState({
    version: draft.version,
    minecraft_version: draft.minecraft_version,
    fabric_loader: draft.fabric_loader,
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate({ ...draft, ...updated });
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const result = await analyzeDraft(draft.id);
      if (result) {
        setSuggestions(result);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const applySuggestion = (field: 'minecraft_version' | 'fabric_loader' | 'version') => {
    if (!suggestions) return;

    let value = '';
    if (field === 'minecraft_version') value = suggestions.minecraft_version || '';
    if (field === 'fabric_loader') value = suggestions.fabric_loader || '';
    if (field === 'version') value = suggestions.suggested_version || '';

    if (value) {
      handleChange(field, value);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow">
        {/* Analysis section */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Intelligent Analysis</h2>
              <p className="text-sm text-gray-600 mt-1">
                Analyze JAR files to detect versions automatically
              </p>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || loading || draft.files.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {analyzing ? 'Analyzing...' : 'Analyze Files'}
            </button>
          </div>

          {draft.files.length === 0 && (
            <p className="text-sm text-yellow-700 bg-yellow-50 px-4 py-3 rounded">
              Upload files first to enable intelligent analysis
            </p>
          )}

          {/* Suggestions */}
          {suggestions && (
            <div className="space-y-3 mt-4">
              {/* Detected mods */}
              {suggestions.detected_mods.length > 0 && (
                <div className="bg-white rounded p-4">
                  <p className="font-medium mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Detected Mods ({suggestions.detected_mods.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {suggestions.detected_mods.slice(0, 6).map((mod) => (
                      <div key={mod.mod_id} className="text-gray-700">
                        • {mod.name || mod.mod_id}
                        {mod.version && <span className="text-gray-500 ml-1">v{mod.version}</span>}
                      </div>
                    ))}
                    {suggestions.detected_mods.length > 6 && (
                      <div className="text-gray-500 col-span-2">
                        ...and {suggestions.detected_mods.length - 6} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Version suggestions */}
              <div className="grid grid-cols-3 gap-3">
                {suggestions.minecraft_version && (
                  <div className="bg-white rounded p-3 text-sm">
                    <p className="text-gray-600 mb-1">Minecraft</p>
                    <p className="font-bold text-lg">{suggestions.minecraft_version}</p>
                  </div>
                )}
                {suggestions.fabric_loader && (
                  <div className="bg-white rounded p-3 text-sm">
                    <p className="text-gray-600 mb-1">Fabric Loader</p>
                    <p className="font-bold text-lg">{suggestions.fabric_loader}</p>
                  </div>
                )}
                {suggestions.suggested_version && (
                  <div className="bg-white rounded p-3 text-sm">
                    <p className="text-gray-600 mb-1">Suggested Version</p>
                    <p className="font-bold text-lg">{suggestions.suggested_version}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form section */}
        <div className="p-6 space-y-6">
          <h2 className="text-xl font-bold">Release Metadata</h2>

          {/* Version */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modpack Version *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.version}
                onChange={(e) => handleChange('version', e.target.value)}
                placeholder="e.g., 1.0.0"
                className="flex-1 px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {suggestions?.suggested_version && formData.version !== suggestions.suggested_version && (
                <button
                  onClick={() => applySuggestion('version')}
                  className="px-4 py-2 bg-green-50 text-green-700 rounded hover:bg-green-100 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Use {suggestions.suggested_version}
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Semantic version for your modpack release
            </p>
          </div>

          {/* Minecraft Version */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minecraft Version *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.minecraft_version}
                onChange={(e) => handleChange('minecraft_version', e.target.value)}
                placeholder="e.g., 1.20.1"
                className="flex-1 px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {suggestions?.minecraft_version && formData.minecraft_version !== suggestions.minecraft_version && (
                <button
                  onClick={() => applySuggestion('minecraft_version')}
                  className="px-4 py-2 bg-green-50 text-green-700 rounded hover:bg-green-100 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Use {suggestions.minecraft_version}
                </button>
              )}
            </div>
          </div>

          {/* Fabric Loader */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fabric Loader Version *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.fabric_loader}
                onChange={(e) => handleChange('fabric_loader', e.target.value)}
                placeholder="e.g., 0.14.21"
                className="flex-1 px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {suggestions?.fabric_loader && formData.fabric_loader !== suggestions.fabric_loader && (
                <button
                  onClick={() => applySuggestion('fabric_loader')}
                  className="px-4 py-2 bg-green-50 text-green-700 rounded hover:bg-green-100 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Use {suggestions.fabric_loader}
                </button>
              )}
            </div>
          </div>

          {/* Info note */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">💡 Tip</p>
            <p>
              Use the "Analyze Files" button to automatically detect versions from uploaded JAR files.
              You can always override suggestions manually.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
