import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useReleasesQuery, useBlacklistQuery } from '@/hooks/queries';
import { Package, FileText, AlertCircle } from 'lucide-react';
import { PageTransition, containerVariants, statsCardVariants, itemVariants } from '@/components/PageTransition';

export default function DashboardPage() {
  const releasesQuery = useReleasesQuery();
  const blacklistQuery = useBlacklistQuery();

  const releases = releasesQuery.data || [];
  const blacklistPatterns = blacklistQuery.data || [];

  const stats = [
    {
      label: 'Active Releases',
      value: releases.length,
      icon: <Package className="w-6 h-6 text-primary" />,
    },
    {
      label: 'Latest Version',
      value: releases[0]?.version || 'None',
      icon: <FileText className="w-6 h-6 text-success" />,
    },
    {
      label: 'Blacklist Rules',
      value: blacklistPatterns.length,
      icon: <AlertCircle className="w-6 h-6 text-warning" />,
    },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {stats.map((stat, i) => (
            <motion.div key={i} variants={statsCardVariants}>
              <Card className="p-6">
                <motion.div
                  className="flex items-start justify-between"
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  {stat.icon}
                </motion.div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Releases */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Recent Releases</h2>
          {releases.length === 0 ? (
            <p className="text-muted-foreground">No releases yet. Start by uploading files and creating a release.</p>
          ) : (
            <motion.div
              className="space-y-3"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {releases.slice(0, 5).map((release) => (
                <motion.div
                  key={release.version}
                  variants={itemVariants}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <p className="font-medium">{release.version}</p>
                    <p className="text-sm text-muted-foreground">
                      {release.minecraft_version} • Fabric {release.fabric_loader}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {release.files?.length || 0} files
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </Card>

      {/* Quick Start */}
      <Card className="p-6 bg-muted/30">
        <h2 className="text-xl font-bold mb-2">Quick Start</h2>
        <p className="text-muted-foreground mb-4">Get started by uploading modpack files and creating a new release.</p>
        <div className="space-y-2 text-sm">
          <p>1. Go to <span className="font-semibold">Upload</span> to upload modpack files</p>
          <p>2. Create a new release with version and changelog</p>
          <p>3. Manage existing releases in <span className="font-semibold">Releases</span></p>
          <p>4. Configure blacklist patterns in <span className="font-semibold">Settings</span></p>
        </div>
      </Card>
    </div>
    </PageTransition>
  );
}
