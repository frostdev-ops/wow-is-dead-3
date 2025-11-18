import { Skeleton } from '@/components/ui/skeleton';

export default function DraftCardSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}
