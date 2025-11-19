import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Upload, FileIcon } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import api from '@/api/client';
import { AxiosError } from 'axios';

export default function LauncherPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [mandatory, setMandatory] = useState(true);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a launcher executable (.exe)");
      return;
    }
    if (!version) {
      setUploadError("Please enter a version number");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('version', version);
      formData.append('changelog', changelog);
      formData.append('mandatory', mandatory.toString());

      await api.post('/admin/launcher', formData);
      
      setUploadSuccess(`Launcher version ${version} uploaded successfully!`);
      // Reset form
      setSelectedFile(null);
      setVersion('');
      setChangelog('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const error = err as AxiosError<{ error: string }>;
      setUploadError(error.response?.data?.error || error.message || "Failed to upload launcher");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-4xl">
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Launcher Updates</h2>
              <p className="text-muted-foreground">
                Upload a new version of the Windows launcher executable (WOWID3Launcher.exe).
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
            {/* File Selection */}
            <div className="p-8 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                 onClick={() => fileInputRef.current?.click()}>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept=".exe"
                onChange={handleFileChange}
              />
              
              {selectedFile ? (
                <div className="text-center">
                  <FileIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <p className="font-semibold text-lg">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
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
                  <p className="font-semibold text-lg">Click to select executable</p>
                  <p className="text-sm text-muted-foreground">Only .exe files are supported</p>
                </div>
              )}
            </div>

            {/* Version Info */}
            <div className="grid md:grid-cols-2 gap-6">
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
            </div>

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

            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || !version || isUploading}
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
                    Release Update
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
