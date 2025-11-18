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
      <Card>
        <CardContent className="pt-6">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Version</th>
                <th className="text-left py-3 px-4">Minecraft</th>
                <th className="text-left py-3 px-4">Files</th>
                <th className="text-left py-3 px-4">Size</th>
                <th className="text-left py-3 px-4">Created</th>
                {showActions && <th className="text-left py-3 px-4">Action</th>}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <ReleaseRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive"
      >
        {error}
      </motion.div>
    );
  }

  if (releases.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground py-8"
          >
            No releases yet. Create one from the Upload Files section.
          </motion.p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-sm">Version</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">Minecraft</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">Files</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">Size</th>
                <th className="text-left py-3 px-4 font-semibold text-sm">Created</th>
                {showActions && <th className="text-left py-3 px-4 font-semibold text-sm">Action</th>}
              </tr>
            </thead>
            <tbody>
              {releases.map((release, index) => (
                <motion.tr
                  key={release.version}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <ReleaseCard
                    release={release}
                    onDelete={handleDeleteRelease}
                    onCopyToDraft={handleCopyReleaseToDraft}
                    isLoading={loading}
                  />
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
