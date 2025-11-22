import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Upload, FileIcon, Download, Trash2, Monitor, Smartphone, Laptop } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import {
  uploadLauncherVersionFile,
  getLauncherVersions,
  getLauncherVersion,
  deleteLauncherVersion
} from '@/api/client';
import type {
  LauncherVersion,
  LauncherVersionsIndex,
  LauncherFile
} from '@/api/types';
import { useToast } from '@/hooks/useToast';

type Platform = 'windows' | 'linux' | 'macos';

const PLATFORM_CONFIG: Record<Platform, {
  label: string;
  icon: typeof Monitor;
  fileExtensions: string[];
  accept: string;
}> = {
  windows: {
    label: 'Windows',
    icon: Monitor,
    fileExtensions: ['.exe'],
    accept: '.exe',
  },
  linux: {
    label: 'Linux',
    icon: Laptop,
    fileExtensions: ['.appimage'],
    accept: '.AppImage',
  },
  macos: {
    label: 'macOS',
    icon: Smartphone,
    fileExtensions: ['.dmg', '.app'],
    accept: '.dmg,.app',
  },
};

export default function LauncherPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [platform, setPlatform] = useState<Platform>('windows');
  const [isNewVersion, setIsNewVersion] = useState(true);
  const [existingVersion, setExistingVersion] = useState('');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Version history state
  const [versionsIndex, setVersionsIndex] = useState<LauncherVersionsIndex | null>(null);
  const [versionDetails, setVersionDetails] = useState<Map<string, LauncherVersion>>(new Map());
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [isDeletingVersion, setIsDeletingVersion] = useState<string | null>(null);

  // Load version history
  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    setIsLoadingVersions(true);
    try {
      const index = await getLauncherVersions();
      setVersionsIndex(index);

      // Load details for each version
      const detailsMap = new Map<string, LauncherVersion>();
      for (const ver of index.versions) {
        try {
          const details = await getLauncherVersion(ver);
          detailsMap.set(ver, details);
        } catch (err) {
          console.error(`Failed to load details for version ${ver}:`, err);
        }
      }
      setVersionDetails(detailsMap);
    } catch (err) {
      console.error('Failed to load versions:', err);
      toast({
        title: 'Error',
        description: 'Failed to load launcher versions',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Validate file extension
      const validExtensions = PLATFORM_CONFIG[platform].fileExtensions;
      const isValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      if (!isValid) {
        setUploadError(`Please select a valid ${PLATFORM_CONFIG[platform].label} file (${validExtensions.join(', ')})`);
        return;
      }

      setSelectedFile(file);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const validateVersion = (ver: string): boolean => {
    // Semantic versioning regex
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
    return semverRegex.test(ver);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a launcher file");
      return;
    }

    const targetVersion = isNewVersion ? version : existingVersion;

    if (!targetVersion) {
      setUploadError("Please enter a version number or select an existing version");
      return;
    }

    if (!validateVersion(targetVersion)) {
      setUploadError("Version must be in semantic versioning format (e.g., 1.2.3)");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const response = await uploadLauncherVersionFile({
        version: targetVersion,
        changelog: isNewVersion ? changelog : '', // Only use changelog for new versions
        mandatory,
        platform,
        file: selectedFile,
      });

      setUploadSuccess(
        `Launcher version ${response.version} for ${PLATFORM_CONFIG[platform].label} uploaded successfully! ` +
        `Available platforms: ${response.platforms.join(', ')}`
      );

      toast({
        title: 'Success',
        description: `${PLATFORM_CONFIG[platform].label} launcher uploaded for version ${response.version}`,
      });

      // Reset form
      setSelectedFile(null);
      setVersion('');
      setChangelog('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reload version list
      await loadVersions();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to upload launcher";
      setUploadError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVersion = async (versionToDelete: string) => {
    if (!confirm(`Are you sure you want to delete version ${versionToDelete}? This will remove all platform files for this version.`)) {
      return;
    }

    setIsDeletingVersion(versionToDelete);
    try {
      await deleteLauncherVersion(versionToDelete);

      toast({
        title: 'Success',
        description: `Version ${versionToDelete} deleted successfully`,
      });

      // Reload versions
      await loadVersions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete version',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingVersion(null);
    }
  };

  const getPlatformIcon = (platformName: string) => {
    const config = PLATFORM_CONFIG[platformName as Platform];
    if (!config) return Monitor;
    return config.icon;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-6xl">
        {/* Upload Section */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Launcher Updates</h2>
              <p className="text-muted-foreground">
                Upload launcher files for Windows, Linux, and macOS
              </p>
            </div>
          </div>

          {uploadError && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Upload Error</p>
                <p className="text-sm text-destructive/90">{uploadError}</p>
              </div>
            </div>
          )}

          {uploadSuccess && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-green-500 font-medium">{uploadSuccess}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Version Selection */}
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={isNewVersion ? 'default' : 'outline'}
                  onClick={() => setIsNewVersion(true)}
                  className="flex-1"
                >
                  New Version
                </Button>
                <Button
                  variant={!isNewVersion ? 'default' : 'outline'}
                  onClick={() => setIsNewVersion(false)}
                  className="flex-1"
                >
                  Add Platform to Existing
                </Button>
              </div>

              {isNewVersion ? (
                <div>
                  <label className="block text-sm font-medium mb-2">Version *</label>
                  <input
                    type="text"
                    placeholder="e.g., 1.1.0"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Semantic versioning (major.minor.patch)</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">Select Existing Version *</label>
                  <select
                    value={existingVersion}
                    onChange={(e) => setExistingVersion(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Select Version --</option>
                    {versionsIndex?.versions.map((ver) => (
                      <option key={ver} value={ver}>
                        {ver}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Platform *</label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((plat) => {
                  const config = PLATFORM_CONFIG[plat];
                  const Icon = config.icon;
                  return (
                    <button
                      key={plat}
                      onClick={() => {
                        setPlatform(plat);
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        platform === plat
                          ? 'border-primary bg-primary/10'
                          : 'border-input hover:border-primary/50'
                      }`}
                    >
                      <Icon className="w-8 h-8 mx-auto mb-2" />
                      <p className="font-medium">{config.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File Selection */}
            <div
              className="p-8 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={PLATFORM_CONFIG[platform].accept}
                onChange={handleFileChange}
              />

              {selectedFile ? (
                <div className="text-center">
                  <FileIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <p className="font-semibold text-lg">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  <Button variant="ghost" size="sm" className="mt-4" onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}>
                    Change File
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-semibold text-lg">Click to select {PLATFORM_CONFIG[platform].label} file</p>
                  <p className="text-sm text-muted-foreground">
                    Supported: {PLATFORM_CONFIG[platform].fileExtensions.join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Changelog (only for new versions) */}
            {isNewVersion && (
              <div>
                <label className="block text-sm font-medium mb-2">Changelog</label>
                <textarea
                  placeholder="What's new in this launcher version?"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            )}

            {/* Mandatory Update */}
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-input rounded-lg w-full hover:bg-accent/50 transition-colors">
                <input
                  type="checkbox"
                  checked={mandatory}
                  onChange={(e) => setMandatory(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-medium block">Mandatory Update</span>
                  <span className="text-xs text-muted-foreground">Users must update before playing</span>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || (!version && !existingVersion) || isUploading}
                size="lg"
                className="min-w-[150px]"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Launcher
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Version History */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Version History</h2>

          {isLoadingVersions ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : !versionsIndex || versionsIndex.versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No launcher versions uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versionsIndex.versions.map((ver) => {
                const details = versionDetails.get(ver);
                if (!details) return null;

                return (
                  <div key={ver} className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold">v{ver}</h3>
                          {ver === versionsIndex.latest && (
                            <Badge variant="success">Latest</Badge>
                          )}
                          {details.mandatory && (
                            <Badge variant="warning">Mandatory</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Released {formatDate(details.released_at)}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteVersion(ver)}
                        disabled={isDeletingVersion === ver}
                      >
                        {isDeletingVersion === ver ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Platform Files */}
                    <div className="grid gap-2 mb-3">
                      {details.files.map((file: LauncherFile) => {
                        const Icon = getPlatformIcon(file.platform);
                        return (
                          <div
                            key={file.platform}
                            className="flex items-center justify-between p-3 bg-background rounded-md"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-5 h-5" />
                              <div>
                                <p className="font-medium capitalize">{file.platform}</p>
                                <p className="text-xs text-muted-foreground">{file.filename}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">
                                {formatFileSize(file.size)}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <a href={file.url} download>
                                  <Download className="w-4 h-4" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Changelog */}
                    {details.changelog && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-sm font-medium mb-1">Changelog:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {details.changelog}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}
