import { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, RotateCcw, Settings, Image, Palette, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCms } from '@/hooks/useCms';
import { useToast } from '@/hooks/use-toast';
import { BrandingTab } from '@/components/cms/BrandingTab';
import { ServerSettingsTab } from '@/components/cms/ServerSettingsTab';
import { UiSettingsTab } from '@/components/cms/UiSettingsTab';
import { PerformanceTab } from '@/components/cms/PerformanceTab';
import { FeaturesTab } from '@/components/cms/FeaturesTab';
import { AssetsTab } from '@/components/cms/AssetsTab';
import { ThemeEditorTab } from '@/components/cms/ThemeEditorTab';

export default function CmsPage() {
  const { toast } = useToast();
  const { config, isLoading, updateConfig, resetConfig } = useCms();
  const [activeTab, setActiveTab] = useState('branding');

  const handleSave = async () => {
    try {
      await updateConfig(config!);
      toast({
        title: 'Configuration Saved',
        description: 'CMS configuration has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      });
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all CMS settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      await resetConfig();
      toast({
        title: 'Configuration Reset',
        description: 'CMS configuration has been reset to defaults.',
      });
    } catch (error) {
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'Failed to reset configuration',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading CMS configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="container mx-auto p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CMS Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Customize your launcher's branding, settings, and themes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} size="sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} size="sm">
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Configuration Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Launcher Customization</CardTitle>
          <CardDescription>
            Configure all aspects of your launcher's appearance and behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="branding" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Branding</span>
              </TabsTrigger>
              <TabsTrigger value="server" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Server</span>
              </TabsTrigger>
              <TabsTrigger value="ui" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">UI</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Performance</span>
              </TabsTrigger>
              <TabsTrigger value="features" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Features</span>
              </TabsTrigger>
              <TabsTrigger value="assets" className="flex items-center gap-1">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Assets</span>
              </TabsTrigger>
              <TabsTrigger value="themes" className="flex items-center gap-1">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Themes</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="branding">
                <BrandingTab />
              </TabsContent>

              <TabsContent value="server">
                <ServerSettingsTab />
              </TabsContent>

              <TabsContent value="ui">
                <UiSettingsTab />
              </TabsContent>

              <TabsContent value="performance">
                <PerformanceTab />
              </TabsContent>

              <TabsContent value="features">
                <FeaturesTab />
              </TabsContent>

              <TabsContent value="assets">
                <AssetsTab />
              </TabsContent>

              <TabsContent value="themes">
                <ThemeEditorTab />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Version:</strong> {config?.version || 'Unknown'}
          </p>
          <p>
            <strong>Last Updated:</strong>{' '}
            {config?.updatedAt
              ? new Date(config.updatedAt * 1000).toLocaleString()
              : 'Never'}
          </p>
          <p className="text-xs mt-4">
            Changes made here will be reflected in the launcher the next time it fetches the configuration.
            Users may need to restart the launcher to see updates.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
