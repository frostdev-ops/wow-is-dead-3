import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useCms } from '@/hooks/useCms';

export function UiSettingsTab() {
  const { config, setConfig } = useCms();

  if (!config) return null;

  const updateUi = (field: string, value: string | boolean | number | string[]) => {
    setConfig({
      ...config,
      ui: {
        ...config.ui,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">User Interface Settings</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure the launcher's UI behavior and defaults
        </p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="defaultTheme">Default Theme</Label>
          <Input
            id="defaultTheme"
            value={config.ui.defaultTheme}
            onChange={(e) => updateUi('defaultTheme', e.target.value)}
            placeholder="christmas"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="availableThemes">Available Themes (comma-separated)</Label>
          <Input
            id="availableThemes"
            value={config.ui.availableThemes.join(', ')}
            onChange={(e) => updateUi('availableThemes', e.target.value.split(',').map(t => t.trim()))}
            placeholder="christmas, dark, light"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="defaultVolume">Default Volume</Label>
            <span className="text-sm text-muted-foreground">
              {Math.round(config.ui.defaultVolume * 100)}%
            </span>
          </div>
          <Slider
            id="defaultVolume"
            min={0}
            max={1}
            step={0.05}
            value={[config.ui.defaultVolume]}
            onValueChange={([value]) => updateUi('defaultVolume', value)}
          />
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="showDiscordToggle">Show Discord Toggle</Label>
            <p className="text-xs text-muted-foreground">
              Allow users to enable/disable Discord Rich Presence
            </p>
          </div>
          <Switch
            id="showDiscordToggle"
            checked={config.ui.showDiscordToggle}
            onCheckedChange={(checked) => updateUi('showDiscordToggle', checked)}
          />
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="showMusicToggle">Show Music Toggle</Label>
            <p className="text-xs text-muted-foreground">
              Allow users to enable/disable background music
            </p>
          </div>
          <Switch
            id="showMusicToggle"
            checked={config.ui.showMusicToggle}
            onCheckedChange={(checked) => updateUi('showMusicToggle', checked)}
          />
        </div>
      </div>
    </div>
  );
}
