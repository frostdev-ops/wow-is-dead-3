import { Edit, Copy, Trash2, FileText, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DraftCardProps } from '../../types/draft';

export default function DraftCard({
  id,
  version,
  minecraft_version,
  fabric_loader,
  files,
  updated_at,
  onEdit,
  onDuplicate,
  onDelete,
  isLoading = false,
}: DraftCardProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-border hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold mb-2 truncate">
          {version || 'Untitled Draft'}
        </h3>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {minecraft_version && (
            <Badge variant="secondary" className="text-xs">
              Minecraft {minecraft_version}
            </Badge>
          )}
          {fabric_loader && (
            <Badge variant="secondary" className="text-xs">
              Fabric {fabric_loader}
            </Badge>
          )}
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {files.length} files
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(updated_at), { addSuffix: true })}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap sm:flex-nowrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(id)}
          disabled={isLoading}
        >
          <Edit className="h-4 w-4" />
          <span className="ml-2">Edit</span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onDuplicate(id, version)}
          disabled={isLoading}
        >
          <Copy className="h-4 w-4" />
          <span className="ml-2">Duplicate</span>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(id, version)}
          disabled={isLoading}
        >
          <Trash2 className="h-4 w-4" />
          <span className="ml-2">Delete</span>
        </Button>
      </div>
    </div>
  );
}
