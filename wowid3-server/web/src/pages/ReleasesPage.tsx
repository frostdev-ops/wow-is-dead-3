import { Suspense } from 'react';
import ReleasesList from '@/components/releases/ReleaseList';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-12">
    <LoadingSpinner message="Loading releases..." />
  </div>
);

export default function ReleasesPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<LoadingFallback />}>
        <ReleasesList />
      </Suspense>
    </div>
  );
}
