import { Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReleaseEditor from '@/pages/ReleaseEditor';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-12">
    <LoadingSpinner message="Loading release..." />
  </div>
);

export default function ReleaseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <PageTransition variant="fade">
        <div className="p-6">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <p className="text-destructive font-semibold">Error: No release ID provided</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition variant="slide">
      <div className="p-6 space-y-4">
        {/* Back Button */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/releases')}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Releases
          </Button>
        </div>

        {/* Editor */}
        <Suspense fallback={<LoadingFallback />}>
          <ReleaseEditor draftId={id} />
        </Suspense>
      </div>
    </PageTransition>
  );
}
