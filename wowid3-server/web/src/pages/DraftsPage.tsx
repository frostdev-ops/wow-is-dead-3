import { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import DraftList from '@/components/drafts/DraftList';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PageTransition } from '@/components/PageTransition';

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-12">
    <LoadingSpinner message="Loading drafts..." />
  </div>
);

export default function DraftsPage() {
  const navigate = useNavigate();

  const handleCreateDraft = () => {
    // DraftList handles the creation and the query will refetch
    // User can then click edit on the newly created draft
  };

  const handleEditDraft = (id: string) => {
    navigate(`/releases/${id}/edit`);
  };

  return (
    <PageTransition>
      <div className="p-6">
        <Suspense fallback={<LoadingFallback />}>
          <DraftList
            filter="all"
            onCreateDraft={handleCreateDraft}
            onEditDraft={handleEditDraft}
          />
        </Suspense>
      </div>
    </PageTransition>
  );
}
