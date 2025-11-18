import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, AlertCircle, X } from 'lucide-react';
import type { UploadProgressDisplayProps } from '../../types/upload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function calculateETA(uploadedBytes: number, totalBytes: number, startTime: number): string {
  const elapsed = Date.now() - startTime;
  const bytesPerMs = uploadedBytes / elapsed;
  const remainingBytes = totalBytes - uploadedBytes;
  const remainingMs = remainingBytes / bytesPerMs;

  if (remainingMs < 1000) return '< 1s';
  if (remainingMs < 60000) return `${Math.ceil(remainingMs / 1000)}s`;
  return `${Math.ceil(remainingMs / 60000)}m`;
}

export default function UploadProgress({
  files,
  totalProgress,
  onCancel,
}: UploadProgressDisplayProps) {
  if (files.length === 0) return null;

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Upload Progress ({completedCount}/{files.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              {uploadingCount > 0 && (
                <Badge variant="info" className="animate-pulse">
                  {uploadingCount} uploading
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive">
                  {errorCount} failed
                </Badge>
              )}
              {onCancel && uploadingCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {totalProgress !== undefined && (
            <div className="mt-4 space-y-2">
              <Progress value={totalProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {totalProgress.toFixed(1)}% complete
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {files.map((file, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.fileSize)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'completed' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </motion.div>
                      )}
                      {file.status === 'uploading' && (
                        <Badge variant="info" className="text-xs">
                          {file.progress}%
                        </Badge>
                      )}
                      {file.status === 'error' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <XCircle className="h-5 w-5 text-destructive" />
                        </motion.div>
                      )}
                      {file.status === 'pending' && (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {file.status === 'uploading' && (
                    <div className="space-y-1">
                      <Progress value={file.progress} className="h-1.5" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatBytes(file.uploadedBytes)} / {formatBytes(file.fileSize)}</span>
                      </div>
                    </div>
                  )}

                  {file.status === 'error' && file.error && (
                    <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{file.error}</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {errorCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{errorCount} file(s) failed to upload</span>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
