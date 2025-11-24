import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useCms } from '@/hooks/useCms';

export function BrandingTab() {
  const { config, setConfig } = useCms();

  if (!config) return null;

  const updateBranding = (field: string, value: string) => {
    setConfig({
      ...config,
      branding: {
        ...config.branding,
        [field]: value || null,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Application Branding</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Customize your launcher's name, tagline, and links
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="appName">Application Name</Label>
          <Input
            id="appName"
            value={config.branding.appName}
            onChange={(e) => updateBranding('appName', e.target.value)}
            placeholder="My Custom Launcher"
          />
          <p className="text-xs text-muted-foreground">
            The name displayed in the launcher window title
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={config.branding.tagline}
            onChange={(e) => updateBranding('tagline', e.target.value)}
            placeholder="Your custom tagline"
          />
          <p className="text-xs text-muted-foreground">
            Subtitle or slogan for your launcher
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            value={config.branding.logoUrl || ''}
            onChange={(e) => updateBranding('logoUrl', e.target.value)}
            placeholder="/api/cms/assets/logo.png"
          />
          <p className="text-xs text-muted-foreground">
            URL to your custom logo (upload in Assets tab)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="faviconUrl">Favicon URL</Label>
          <Input
            id="faviconUrl"
            value={config.branding.faviconUrl || ''}
            onChange={(e) => updateBranding('faviconUrl', e.target.value)}
            placeholder="/api/cms/assets/favicon.ico"
          />
          <p className="text-xs text-muted-foreground">
            URL to your custom favicon icon
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="discordUrl">Discord Server URL</Label>
          <Input
            id="discordUrl"
            value={config.branding.discordUrl || ''}
            onChange={(e) => updateBranding('discordUrl', e.target.value)}
            placeholder="https://discord.gg/your-server"
          />
          <p className="text-xs text-muted-foreground">
            Link to your Discord community
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Website URL</Label>
          <Input
            id="websiteUrl"
            value={config.branding.websiteUrl || ''}
            onChange={(e) => updateBranding('websiteUrl', e.target.value)}
            placeholder="https://your-website.com"
          />
          <p className="text-xs text-muted-foreground">
            Link to your main website
          </p>
        </div>
      </div>
    </div>
  );
}
