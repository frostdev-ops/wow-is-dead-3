import { useState, useEffect } from 'react';
import { Trash2, Download, Copy, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';

export interface ResourcePack {
  file_name: string;
  file_size: number;
  sha256: string;
  upload_id: string;
  message: string;
}

interface ResourcePackListProps {
  resourcePacks: ResourcePack[];
  onDelete: (filename: string) => Promise<void>;
  isDeleting?: boolean;
  baseUrl?: string;
}

export default function ResourcePackList({
  resourcePacks,
  onDelete,
  isDeleting = false,
  baseUrl = 'https://wowid-launcher.frostdev.io',
}: ResourcePackListProps) {
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting_, setIsDeleting] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getDownloadUrl = (filename: string): string => {
    return `${baseUrl}/api/resources/${encodeURIComponent(filename)}`;
  };

  const handleCopyUrl = (filename: string) => {
    const url = getDownloadUrl(filename);
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied!',
      description: 'Download URL copied to clipboard',
    });
  };

  const handleDeleteConfirm = async (filename: string) => {
    setIsDeleting(true);
    try {
      await onDelete(filename);
      toast({
        title: 'Deleted',
        description: `${filename} has been deleted`,
      });
      setDeleteConfirm(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete resource pack',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (resourcePacks.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No resource packs uploaded yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Upload your first resource pack using the upload zone above
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left px-6 py-3 font-semibold">File Name</th>
                <th className="text-right px-6 py-3 font-semibold">Size</th>
                <th className="text-left px-6 py-3 font-semibold">Hash</th>
                <th className="text-right px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resourcePacks.map((pack) => (
                <motion.tr
                  key={pack.file_name}
                  className="border-b hover:bg-muted/30 transition-colors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="font-medium truncate">{pack.file_name}</p>
                      <p className="text-xs text-muted-foreground">{pack.message}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    {formatFileSize(pack.file_size)}
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {pack.sha256.substring(0, 12)}...
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyUrl(pack.file_name)}
                        title="Copy download URL"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        title="Download file"
                      >
                        <a href={getDownloadUrl(pack.file_name)} download>
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteConfirm(pack.file_name)}
                        disabled={isDeleting_ || isDeleting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resource Pack</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <code className="text-xs bg-muted px-1 py-0.5 rounded">{deleteConfirm}</code>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={isDeleting_}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteConfirm(deleteConfirm)}
              disabled={isDeleting_}
            >
              {isDeleting_ ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
