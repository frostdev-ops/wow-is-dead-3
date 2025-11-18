import { useState, lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUploadMutation, useCreateReleaseMutation } from '@/hooks/queries';
import { AlertCircle, CheckCircle, Upload } from 'lucide-react';

const FileUploadZone = lazy(() => import('@/components/uploads/FileUploadZone'));
const UploadProgress = lazy(() => import('@/components/uploads/UploadProgress'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mr-3"></div>
    <span>Loading...</span>
  </div>
);

export default function UploadPage() {
  const uploadMutation = useUploadMutation();
  const createReleaseMutation = useCreateReleaseMutation();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<any>(null);

  const [releaseForm, setReleaseForm] = useState({
    version: '',
    minecraftVersion: '',
    fabricLoader: '',
    changelog: '',
  });

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setUploadError(null);
    setUploadSuccess(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    uploadMutation.mutate(
      { files: selectedFiles },
      {
        onSuccess: (data) => {
          setUploadResults(data);
          setUploadSuccess('Files uploaded successfully! Now create a release with the form below.');
          setUploadError(null);
        },
        onError: (error: any) => {
          setUploadError(error.message || 'Upload failed');
          setUploadSuccess(null);
        },
      }
    );
  };

  const handleCreateRelease = async () => {
    if (!uploadResults || !releaseForm.version) {
      setUploadError('Please upload files and fill in the version field');
      return;
    }

    createReleaseMutation.mutate(
      {
        upload_id: uploadResults.upload_id,
        version: releaseForm.version,
        minecraft_version: releaseForm.minecraftVersion,
        fabric_loader: releaseForm.fabricLoader,
        changelog: releaseForm.changelog,
      },
      {
        onSuccess: () => {
          setUploadSuccess('Release created successfully!');
          setReleaseForm({ version: '', minecraftVersion: '', fabricLoader: '', changelog: '' });
          setSelectedFiles([]);
          setUploadResults(null);
          setUploadError(null);
        },
        onError: (error: any) => {
          setUploadError(error.message || 'Failed to create release');
          setUploadSuccess(null);
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* File Upload Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Upload Modpack Files</h2>
        <p className="text-muted-foreground mb-6">
          Upload the modpack directory or individual files. The system will automatically create a manifest for distribution.
        </p>

        {uploadError && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Upload Error</p>
              <p className="text-sm text-destructive/90">{uploadError}</p>
            </div>
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-900">{uploadSuccess}</p>
          </div>
        )}

        {selectedFiles.length === 0 ? (
          <Suspense fallback={<LoadingFallback />}>
            <FileUploadZone onFilesSelected={handleFilesSelected} multiple={true} webkitdirectory={true} />
          </Suspense>
        ) : (
          <div className="space-y-4">
            <div className="bg-accent rounded-lg p-4">
              <p className="font-semibold mb-3">Selected Files ({selectedFiles.length})</p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {selectedFiles.slice(0, 20).map((file, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate">{file.name}</span>
                    <span className="text-muted-foreground flex-shrink-0 ml-2">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ))}
                {selectedFiles.length > 20 && (
                  <p className="text-sm text-muted-foreground">... and {selectedFiles.length - 20} more files</p>
                )}
              </div>
            </div>

            {uploadMutation.isPending && (
              <Suspense fallback={<LoadingFallback />}>
                <UploadProgress />
              </Suspense>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setSelectedFiles([])} variant="outline">
                Clear Selection
              </Button>
              <Button onClick={handleUpload} disabled={uploadMutation.isPending} className="flex gap-2">
                <Upload className="w-4 h-4" />
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Release Creation Form */}
      {uploadResults && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Create Release</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Version *</label>
              <input
                type="text"
                placeholder="e.g., 1.0.0"
                value={releaseForm.version}
                onChange={(e) => setReleaseForm({ ...releaseForm, version: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Use semantic versioning (major.minor.patch)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Minecraft Version</label>
                <input
                  type="text"
                  placeholder="e.g., 1.20.1"
                  value={releaseForm.minecraftVersion}
                  onChange={(e) => setReleaseForm({ ...releaseForm, minecraftVersion: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fabric Loader Version</label>
                <input
                  type="text"
                  placeholder="e.g., 0.15.3"
                  value={releaseForm.fabricLoader}
                  onChange={(e) => setReleaseForm({ ...releaseForm, fabricLoader: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Changelog</label>
              <textarea
                placeholder="Describe what's new in this release..."
                value={releaseForm.changelog}
                onChange={(e) => setReleaseForm({ ...releaseForm, changelog: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button
              onClick={handleCreateRelease}
              disabled={createReleaseMutation.isPending}
              className="w-full"
            >
              {createReleaseMutation.isPending ? 'Creating...' : 'Create Release'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
