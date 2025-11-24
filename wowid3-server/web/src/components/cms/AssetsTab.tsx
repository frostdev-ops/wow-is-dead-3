import { useState, useEffect } from 'react';
import { Upload, Trash2, Image, Music, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useCms, AssetMetadata } from '@/hooks/useCms';
import { useToast } from '@/hooks/use-toast';

export function AssetsTab() {
  const { config, setConfig, listAssets, uploadAsset, deleteAsset } = useCms();
  const { toast } = useToast();
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const assetList = await listAssets();
      setAssets(assetList);
    } catch (error) {
      toast({
        title: 'Failed to Load Assets',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file);
      }

      toast({
        title: 'Assets Uploaded',
        description: `Successfully uploaded ${files.length} file(s)`,
      });

      await loadAssets();
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload assets',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;

    try {
      await deleteAsset(filename);
      toast({
        title: 'Asset Deleted',
        description: `${filename} has been deleted`,
      });
      await loadAssets();
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete asset',
        variant: 'destructive',
      });
    }
  };

  const updateAssetReference = (type: string, filename: string) => {
    if (!config) return;

    if (type === 'menuMusic') {
      setConfig({
        ...config,
        assets: {
          ...config.assets,
          menuMusic: filename,
        },
      });
    } else if (type === 'menuMusicFallback') {
      setConfig({
        ...config,
        assets: {
          ...config.assets,
          menuMusicFallback: filename,
        },
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'audio':
        return <Music className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!config) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Asset Management</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Upload and manage custom assets for your launcher
        </p>
      </div>

      {/* Upload Section */}
      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <Label htmlFor="assetUpload" className="cursor-pointer">
          <span className="text-sm font-medium">Upload Assets</span>
          <span className="text-xs text-muted-foreground block mt-1">
            Supports images, audio, fonts, and other files
          </span>
        </Label>
        <Input
          id="assetUpload"
          type="file"
          multiple
          onChange={handleUpload}
          disabled={isUploading}
          className="hidden"
        />
        <Button
          variant="outline"
          className="mt-4"
          disabled={isUploading}
          onClick={() => document.getElementById('assetUpload')?.click()}
        >
          {isUploading ? 'Uploading...' : 'Choose Files'}
        </Button>
      </div>

      {/* Asset References */}
      <div className="space-y-4">
        <h4 className="font-medium">Asset References</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="menuMusic">Menu Music</Label>
            <Input
              id="menuMusic"
              value={config.assets.menuMusic || ''}
              onChange={(e) => updateAssetReference('menuMusic', e.target.value)}
              placeholder="background-music.mp3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menuMusicFallback">Menu Music (Fallback)</Label>
            <Input
              id="menuMusicFallback"
              value={config.assets.menuMusicFallback || ''}
              onChange={(e) => updateAssetReference('menuMusicFallback', e.target.value)}
              placeholder="background-music-fallback.mp3"
            />
          </div>
        </div>
      </div>

      {/* Asset List */}
      <div>
        <h4 className="font-medium mb-4">Uploaded Assets</h4>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading assets...</div>
        ) : assets.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No assets uploaded yet</div>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => (
              <div
                key={asset.filename}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded">
                    {getCategoryIcon(asset.category)}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{asset.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(asset.size)} • {asset.mimeType}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const url = `/api/cms/assets/${asset.filename}`;
                      navigator.clipboard.writeText(url);
                      toast({
                        title: 'URL Copied',
                        description: 'Asset URL copied to clipboard',
                      });
                    }}
                  >
                    Copy URL
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(asset.filename)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
