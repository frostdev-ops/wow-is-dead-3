import { useEffect } from 'react';
import { useReleaseOperations } from '../../hooks/useReleaseOperations';
import ReleaseCard from './ReleaseCard';
import type { ReleaseListProps } from '../../types/release';

export default function ReleaseList({ showActions = true }: ReleaseListProps) {
  const { releases, loading, error, listReleases, deleteRelease, copyReleaseToDraft } =
    useReleaseOperations();

  useEffect(() => {
    listReleases();
  }, []);

  const handleDeleteRelease = async (version: string) => {
    if (confirm(`Are you sure you want to delete release ${version}?`)) {
      await deleteRelease(version);
    }
  };

  const handleCopyReleaseToDraft = async (version: string) => {
    const newDraft = await copyReleaseToDraft(version);
    if (newDraft) {
      // You might want to navigate to the draft editor here
      // or show a success message
    }
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
