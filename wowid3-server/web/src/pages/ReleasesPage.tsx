import { Suspense } from 'react';
import ReleasesList from '@/components/releases/ReleaseList';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageTransition } from '@/components/PageTransition';

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-12">
    <LoadingSpinner message="Loading releases..." />
  </div>
);

export default function ReleasesPage() {
  return (
    <PageTransition>
      <div className="p-6">
        <Suspense fallback={<LoadingFallback />}>
          <ReleasesList />
        </Suspense>
      </div>
    </PageTransition>
  );
}
