import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useCms } from '@/hooks/useCms';

export function ServerSettingsTab() {
  const { config, setConfig } = useCms();

  if (!config) return null;

  const updateServer = (field: string, value: string | boolean) => {
    setConfig({
      ...config,
      server: {
        ...config.server,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Server Connection Settings</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure default server and modpack settings
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="serverAddress">Default Minecraft Server</Label>
          <Input
            id="serverAddress"
            value={config.server.defaultServerAddress}
            onChange={(e) => updateServer('defaultServerAddress', e.target.value)}
            placeholder="mc.your-server.com:25565"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="manifestUrl">Manifest URL</Label>
          <Input
            id="manifestUrl"
            value={config.server.defaultManifestUrl}
            onChange={(e) => updateServer('defaultManifestUrl', e.target.value)}
            placeholder="https://your-server.com/api/manifest/latest"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minecraftVersion">Minecraft Version</Label>
          <Input
            id="minecraftVersion"
            value={config.server.minecraftVersion}
            onChange={(e) => updateServer('minecraftVersion', e.target.value)}
            placeholder="1.20.1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fabricVersion">Fabric Loader Version</Label>
          <Input
            id="fabricVersion"
            value={config.server.fabricVersion}
            onChange={(e) => updateServer('fabricVersion', e.target.value)}
            placeholder="0.15.0"
          />
        </div>

        <div className="flex items-center justify-between space-x-2 md:col-span-2">
          <div className="space-y-0.5">
            <Label htmlFor="fabricRequired">Fabric Required</Label>
            <p className="text-xs text-muted-foreground">
              Require Fabric mod loader for the modpack
            </p>
          </div>
          <Switch
            id="fabricRequired"
            checked={config.server.fabricRequired}
            onCheckedChange={(checked) => updateServer('fabricRequired', checked)}
          />
        </div>
      </div>
    </div>
  );
}
