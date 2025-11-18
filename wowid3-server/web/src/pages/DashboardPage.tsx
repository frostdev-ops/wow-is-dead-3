import { Card } from '@/components/ui/card';
import { useReleasesQuery, useBlacklistQuery } from '@/hooks/queries';
import { Package, FileText, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const releasesQuery = useReleasesQuery();
  const blacklistQuery = useBlacklistQuery();

  const releases = releasesQuery.data || [];
  const blacklistPatterns = blacklistQuery.data || [];

  const stats = [
    {
      label: 'Active Releases',
      value: releases.length,
      icon: <Package className="w-6 h-6 text-blue-600" />,
      color: 'bg-blue-50',
      labelColor: 'text-blue-700',
      valueColor: 'text-blue-900',
    },
    {
      label: 'Latest Version',
      value: releases[0]?.version || 'None',
      icon: <FileText className="w-6 h-6 text-green-600" />,
      color: 'bg-green-50',
      labelColor: 'text-green-700',
      valueColor: 'text-green-900',
    },
    {
      label: 'Blacklist Rules',
      value: blacklistPatterns.length,
      icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
      color: 'bg-amber-50',
      labelColor: 'text-amber-700',
      valueColor: 'text-amber-900',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className={`${stat.color} p-6`}>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className={`text-sm font-medium ${stat.labelColor}`}>{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.valueColor}`}>{stat.value}</p>
              </div>
              {stat.icon}
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Releases */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Recent Releases</h2>
        {releases.length === 0 ? (
          <p className="text-muted-foreground">No releases yet. Start by uploading files and creating a release.</p>
        ) : (
          <div className="space-y-3">
            {releases.slice(0, 5).map((release) => (
              <div key={release.version} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                <div>
                  <p className="font-medium">{release.version}</p>
                  <p className="text-sm text-muted-foreground">
                    {release.minecraft_version} • Fabric {release.fabric_loader}
                  </p>
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  {release.files?.length || 0} files
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Start */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5">
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
  );
}
