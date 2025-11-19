import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { AlertCircle, CheckCircle, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/useToast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const ResourcePackUploadZone = lazy(
  () => import('@/components/resources/ResourcePackUploadZone')
);
const ResourcePackList = lazy(() => import('@/components/resources/ResourcePackList'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <LoadingSpinner message="Loading..." />
  </div>
);

interface UploadResult {
  upload_id: string;
  file_name: string;
  file_size: number;
  sha256: string;
  message: string;
}

export default function ResourcePacksPage() {
  const { uploadResourcePacks, deleteResourcePack, listResourcePacks, loading } = useAdmin();
  const { toast } = useToast();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(true);

  // Load persisted resources on mount
  useEffect(() => {
    const loadResources = async () => {
      try {
        const resources = await listResourcePacks();
        setUploadResults(
          resources.map((r: any) => ({
            upload_id: 'resources',
            file_name: r.file_name,
            file_size: r.file_size,
            sha256: r.sha256,
            message: 'Persisted resource',
          }))
        );
      } catch (error: any) {
        console.error('Failed to load resources:', error);
        // Don't show error toast on initial load, just log it
      } finally {
        setIsLoadingResources(false);
      }
    };

    loadResources();
  }, [listResourcePacks]);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setUploadError(null);
    setUploadSuccess(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Please select files to upload');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await uploadResourcePacks(selectedFiles);

      // Reload the list to show all resources including newly uploaded ones
      const resources = await listResourcePacks();
      setUploadResults(
        resources.map((r: any) => ({
          upload_id: 'resources',
          file_name: r.file_name,
          file_size: r.file_size,
          sha256: r.sha256,
          message: 'Persisted resource',
        }))
      );

      setUploadSuccess(`Successfully uploaded ${selectedFiles.length} file(s)`);
      setSelectedFiles([]);

      toast({
        title: 'Success',
        description: `${selectedFiles.length} resource pack(s) uploaded successfully`,
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Upload failed';
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

  const handleDelete = useCallback(
    async (filename: string) => {
      try {
        await deleteResourcePack(filename);
        // Reload the list to ensure it's synced with server
        const resources = await listResourcePacks();
        setUploadResults(
          resources.map((r: any) => ({
            upload_id: 'resources',
            file_name: r.file_name,
            file_size: r.file_size,
            sha256: r.sha256,
            message: 'Persisted resource',
          }))
        );
      } catch (error) {
        throw error;
      }
    },
    [deleteResourcePack, listResourcePacks]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-3">
          <Package className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Resource Packs</h1>
          <p className="text-muted-foreground">Upload and manage resource pack files</p>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Upload Resource Packs</h2>
        <Suspense fallback={<LoadingFallback />}>
          <ResourcePackUploadZone
            onFilesSelected={handleFilesSelected}
            isLoading={isUploading}
            disabled={loading}
          />
        </Suspense>

        {/* Upload Error */}
        {uploadError && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-md flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Upload Error</p>
              <p className="text-sm text-destructive/80">{uploadError}</p>
            </div>
          </div>
        )}

        {/* Upload Success */}
        {uploadSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900 dark:text-green-100">Success</p>
              <p className="text-sm text-green-800 dark:text-green-200">{uploadSuccess}</p>
            </div>
          </div>
        )}

        {/* Upload Button */}
        {selectedFiles.length > 0 && (
          <Button
            onClick={handleUpload}
            disabled={isUploading || loading}
            size="lg"
            className="w-full"
          >
            {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
          </Button>
        )}
      </Card>

      {/* List Section */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Uploaded Resource Packs</h2>
        {isLoadingResources ? (
          <LoadingFallback />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <ResourcePackList
              resourcePacks={uploadResults}
              onDelete={handleDelete}
              isDeleting={loading}
            />
          </Suspense>
        )}
      </Card>

      {/* Info Section */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Download URL Format</h3>
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
          Resource packs can be downloaded from your server using the following URL pattern:
        </p>
        <code className="text-xs bg-blue-100 dark:bg-blue-900 px-3 py-2 rounded block font-mono text-blue-900 dark:text-blue-100">
          https://wowid-launcher.frostdev.io/api/resources/filename.zip
        </code>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
          Copy the download URL for each resource pack using the copy button in the list above.
        </p>
      </Card>
    </div>
  );
}
