import { Skeleton } from '@/components/ui/skeleton';

export default function ReleaseRowSkeleton() {
  return (
    <tr>
      <td><Skeleton className="h-4 w-24" /></td>
      <td><Skeleton className="h-4 w-32" /></td>
      <td><Skeleton className="h-4 w-16" /></td>
      <td><Skeleton className="h-4 w-20" /></td>
      <td><Skeleton className="h-4 w-28" /></td>
      <td>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </td>
    </tr>
  );
}
