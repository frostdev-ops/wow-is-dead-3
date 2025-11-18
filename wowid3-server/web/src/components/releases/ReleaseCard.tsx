import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReleaseCardProps } from '../../types/release';

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReleaseCard({
  release,
  onDelete,
  onCopyToDraft,
  isLoading = false,
}: ReleaseCardProps) {
  return (
    <>
      <td className="py-3 px-4">
        <Badge variant="success">{release.version}</Badge>
      </td>
      <td className="py-3 px-4 text-sm">{release.minecraft_version}</td>
      <td className="py-3 px-4 text-sm">{release.file_count}</td>
      <td className="py-3 px-4 text-sm">{formatBytes(release.size_bytes)}</td>
      <td className="py-3 px-4 text-sm text-muted-foreground">{formatDate(release.created_at)}</td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCopyToDraft(release.version)}
            disabled={isLoading}
          >
            <Copy className="h-3 w-3" />
            <span className="ml-2 hidden sm:inline">Copy to Draft</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(release.version)}
            disabled={isLoading}
          >
            <Trash2 className="h-3 w-3" />
            <span className="ml-2 hidden sm:inline">Delete</span>
          </Button>
        </div>
      </td>
    </>
  );
}
