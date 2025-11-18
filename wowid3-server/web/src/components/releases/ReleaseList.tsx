import { motion } from 'framer-motion';
import {
  useReleasesQuery,
  useDeleteReleaseMutation,
  useCopyReleaseToDraftMutation,
} from '../../hooks/queries';
import ReleaseCard from './ReleaseCard';
import ReleaseRowSkeleton from './ReleaseRowSkeleton';
import { Card, CardContent } from '@/components/ui/card';
import type { ReleaseListProps } from '../../types/release';

export default function ReleaseList({ showActions = true }: ReleaseListProps) {
  const releasesQuery = useReleasesQuery();
  const deleteReleaseMutation = useDeleteReleaseMutation();
  const copyReleaseMutation = useCopyReleaseToDraftMutation();

  const releases = releasesQuery.data || [];
  const loading = releasesQuery.isLoading;
  const error = releasesQuery.error?.message;

  const handleDeleteRelease = async (version: string) => {
    if (confirm(`Are you sure you want to delete release ${version}?`)) {
      deleteReleaseMutation.mutate(version);
    }
  };

  const handleCopyReleaseToDraft = async (version: string) => {
    copyReleaseMutation.mutate(version, {
      onSuccess: () => {
        // You might want to navigate to the draft editor here
        // or show a success message
      },
    });
  };

  if (loading && releases.length === 0) {
    return (
      <div className="card">
        <p>Loading releases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        {error}
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="card">
        <p>No releases yet. Create one from the Upload Files section.</p>
      </div>
    );
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Version</th>
          <th>Minecraft</th>
          <th>Files</th>
          <th>Size</th>
          <th>Created</th>
          {showActions && <th>Action</th>}
        </tr>
      </thead>
      <tbody>
        {releases.map((release) => (
          <ReleaseCard
            key={release.version}
            release={release}
            onDelete={handleDeleteRelease}
            onCopyToDraft={handleCopyReleaseToDraft}
            isLoading={loading}
          />
        ))}
      </tbody>
    </table>
  );
}
