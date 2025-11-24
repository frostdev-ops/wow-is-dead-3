import { useState } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCms, ThemeConfig } from '@/hooks/useCms';
import { useToast } from '@/hooks/use-toast';

export function ThemeEditorTab() {
  const { config, setConfig } = useCms();
  const { toast } = useToast();
  const [selectedThemeId, setSelectedThemeId] = useState<string>('christmas');

  if (!config) return null;

  const selectedTheme = config.themes.find((t) => t.id === selectedThemeId);

  const updateTheme = (updates: Partial<ThemeConfig>) => {
    setConfig({
      ...config,
      themes: config.themes.map((t) =>
        t.id === selectedThemeId ? { ...t, ...updates } : t
      ),
    });
  };

  const updateColors = (field: string, value: string) => {
    if (!selectedTheme) return;
    updateTheme({
      colors: {
        ...selectedTheme.colors,
        [field]: value,
      },
    });
  };

  const updateBackground = (field: string, value: string | null) => {
    if (!selectedTheme) return;
    updateTheme({
      background: {
        ...selectedTheme.background,
        [field]: value,
      },
    });
  };

  const updateTypography = (field: string, value: string | number) => {
    if (!selectedTheme) return;
    updateTheme({
      typography: {
        ...selectedTheme.typography,
        [field]: value,
      },
    });
  };

  const updateAnimations = (field: string, value: string | boolean) => {
    if (!selectedTheme) return;
    updateTheme({
      animations: {
        ...selectedTheme.animations,
        [field]: value,
      },
    });
  };

  const addNewTheme = () => {
    const newId = `custom-${Date.now()}`;
    const newTheme: ThemeConfig = {
      id: newId,
      name: 'New Theme',
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        accent: '#06b6d4',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        textSecondary: '#64748b',
        border: '#e2e8f0',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      background: {
        type: 'solid',
        color: '#ffffff',
        image: null,
        gradient: null,
        animation: null,
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        headingFont: 'Inter, system-ui, sans-serif',
        fontSizeBase: '16px',
        fontWeightNormal: 400,
        fontWeightBold: 600,
      },
      animations: {
        enableAnimations: true,
        transitionSpeed: '300ms',
        animationTiming: 'ease-in-out',
      },
    };

    setConfig({
      ...config,
      themes: [...config.themes, newTheme],
    });
    setSelectedThemeId(newId);

    toast({
      title: 'Theme Created',
      description: 'New theme has been added. Don\'t forget to save!',
    });
  };

  const duplicateTheme = () => {
    if (!selectedTheme) return;

    const newId = `${selectedTheme.id}-copy-${Date.now()}`;
    const duplicated = {
      ...selectedTheme,
      id: newId,
      name: `${selectedTheme.name} (Copy)`,
    };

    setConfig({
      ...config,
      themes: [...config.themes, duplicated],
    });
    setSelectedThemeId(newId);

    toast({
      title: 'Theme Duplicated',
      description: 'Theme has been duplicated successfully',
    });
  };

  const deleteTheme = () => {
    if (!selectedTheme) return;
    if (config.themes.length <= 1) {
      toast({
        title: 'Cannot Delete',
        description: 'You must have at least one theme',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Delete theme "${selectedTheme.name}"?`)) return;

    setConfig({
      ...config,
      themes: config.themes.filter((t) => t.id !== selectedThemeId),
    });
    setSelectedThemeId(config.themes[0].id);

    toast({
      title: 'Theme Deleted',
      description: 'Theme has been removed',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1">Theme Editor</h3>
          <p className="text-sm text-muted-foreground">
            Create and customize launcher themes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={duplicateTheme}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={addNewTheme}>
            <Plus className="mr-2 h-4 w-4" />
            New Theme
          </Button>
        </div>
      </div>

      {/* Theme Selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.themes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  {theme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="destructive"
          size="icon"
          onClick={deleteTheme}
          disabled={config.themes.length <= 1}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {selectedTheme && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="font-medium">Basic Information</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="themeId">Theme ID</Label>
                <Input
                  id="themeId"
                  value={selectedTheme.id}
                  onChange={(e) => updateTheme({ id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="themeName">Theme Name</Label>
                <Input
                  id="themeName"
                  value={selectedTheme.name}
                  onChange={(e) => updateTheme({ name: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-4">
            <h4 className="font-medium">Color Palette</h4>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {Object.entries(selectedTheme.colors).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`color-${key}`} className="capitalize text-xs">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`color-${key}`}
                      type="color"
                      value={value}
                      onChange={(e) => updateColors(key, e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={value}
                      onChange={(e) => updateColors(key, e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="space-y-4">
            <h4 className="font-medium">Background</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bgType">Background Type</Label>
                <Select
                  value={selectedTheme.background.type}
                  onValueChange={(value) => updateBackground('type', value)}
                >
                  <SelectTrigger id="bgType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid Color</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="animated">Animated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bgColor">Background Color</Label>
                <Input
                  id="bgColor"
                  type="color"
                  value={selectedTheme.background.color}
                  onChange={(e) => updateBackground('color', e.target.value)}
                />
              </div>
              {selectedTheme.background.type === 'image' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bgImage">Background Image URL</Label>
                  <Input
                    id="bgImage"
                    value={selectedTheme.background.image || ''}
                    onChange={(e) => updateBackground('image', e.target.value || null)}
                    placeholder="/api/cms/assets/background.png"
                  />
                </div>
              )}
              {selectedTheme.background.type === 'animated' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bgAnimation">Animation Type</Label>
                  <Input
                    id="bgAnimation"
                    value={selectedTheme.background.animation || ''}
                    onChange={(e) => updateBackground('animation', e.target.value || null)}
                    placeholder="snow, particles, etc."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-4">
            <h4 className="font-medium">Typography</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fontFamily">Font Family</Label>
                <Input
                  id="fontFamily"
                  value={selectedTheme.typography.fontFamily}
                  onChange={(e) => updateTypography('fontFamily', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headingFont">Heading Font</Label>
                <Input
                  id="headingFont"
                  value={selectedTheme.typography.headingFont}
                  onChange={(e) => updateTypography('headingFont', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontSize">Base Font Size</Label>
                <Input
                  id="fontSize"
                  value={selectedTheme.typography.fontSizeBase}
                  onChange={(e) => updateTypography('fontSizeBase', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontWeightNormal">Normal Weight</Label>
                <Input
                  id="fontWeightNormal"
                  type="number"
                  value={selectedTheme.typography.fontWeightNormal}
                  onChange={(e) => updateTypography('fontWeightNormal', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Animations */}
          <div className="space-y-4">
            <h4 className="font-medium">Animations</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enableAnimations">Enable Animations</Label>
                <Switch
                  id="enableAnimations"
                  checked={selectedTheme.animations.enableAnimations}
                  onCheckedChange={(checked) => updateAnimations('enableAnimations', checked)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transitionSpeed">Transition Speed</Label>
                  <Input
                    id="transitionSpeed"
                    value={selectedTheme.animations.transitionSpeed}
                    onChange={(e) => updateAnimations('transitionSpeed', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="animationTiming">Animation Timing</Label>
                  <Input
                    id="animationTiming"
                    value={selectedTheme.animations.animationTiming}
                    onChange={(e) => updateAnimations('animationTiming', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
