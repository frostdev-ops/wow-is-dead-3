import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCms } from '@/hooks/useCms';

export function FeaturesTab() {
  const { config, setConfig } = useCms();

  if (!config) return null;

  const updateFeature = (field: string, value: boolean) => {
    setConfig({
      ...config,
      features: {
        ...config.features,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Feature Flags</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Enable or disable launcher features
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="enableDiscord">Discord Rich Presence</Label>
            <p className="text-xs text-muted-foreground">
              Show game activity on Discord
            </p>
          </div>
          <Switch
            id="enableDiscord"
            checked={config.features.enableDiscord}
            onCheckedChange={(checked) => updateFeature('enableDiscord', checked)}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="enableStats">Statistics Tracking</Label>
            <p className="text-xs text-muted-foreground">
              Track and display player statistics
            </p>
          </div>
          <Switch
            id="enableStats"
            checked={config.features.enableStats}
            onCheckedChange={(checked) => updateFeature('enableStats', checked)}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="enableMapViewer">Map Viewer</Label>
            <p className="text-xs text-muted-foreground">
              Enable in-launcher map viewing
            </p>
          </div>
          <Switch
            id="enableMapViewer"
            checked={config.features.enableMapViewer}
            onCheckedChange={(checked) => updateFeature('enableMapViewer', checked)}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="enableAutoUpdate">Auto Update</Label>
            <p className="text-xs text-muted-foreground">
              Automatically check and download updates
            </p>
          </div>
          <Switch
            id="enableAutoUpdate"
            checked={config.features.enableAutoUpdate}
            onCheckedChange={(checked) => updateFeature('enableAutoUpdate', checked)}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="enableCrashReporting">Crash Reporting</Label>
            <p className="text-xs text-muted-foreground">
              Send crash reports for debugging
            </p>
          </div>
          <Switch
            id="enableCrashReporting"
            checked={config.features.enableCrashReporting}
            onCheckedChange={(checked) => updateFeature('enableCrashReporting', checked)}
          />
        </div>

        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="enableTelemetry">Telemetry</Label>
            <p className="text-xs text-muted-foreground">
              Send anonymous usage data
            </p>
          </div>
          <Switch
            id="enableTelemetry"
            checked={config.features.enableTelemetry}
            onCheckedChange={(checked) => updateFeature('enableTelemetry', checked)}
          />
        </div>
      </div>
    </div>
  );
}
