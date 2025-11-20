import { lazy, Suspense } from 'react';
import { LoadingSpinner } from './ui/LoadingSpinner';

// Lazy load Three.js components to reduce initial bundle size
// These components are only loaded when the user is authenticated
export const SkinViewerLazy = lazy(() =>
  import('./SkinViewer').then((module) => ({
    default: module.SkinViewerComponent,
  }))
);

export const CatModelLazy = lazy(() =>
  import('./CatModel').then((module) => ({
    default: module.CatModel,
  }))
);

// Wrapper component for SkinViewer with loading fallback
export const SkinViewerWithSuspense = (props: {
  username: string;
  uuid: string;
  skinUrl?: string;
}) => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center w-[300px] h-[600px]">
        <LoadingSpinner size="lg" />
      </div>
    }
  >
    <SkinViewerLazy {...props} />
  </Suspense>
);

// Wrapper component for CatModel with loading fallback
export const CatModelWithSuspense = () => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center w-[400px] h-[600px]">
        <LoadingSpinner size="lg" />
      </div>
    }
  >
    <CatModelLazy />
  </Suspense>
);