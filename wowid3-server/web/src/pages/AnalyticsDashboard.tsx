import { useMemo } from 'react';
import { BarChart, TrendingUp, Package, Calendar, Download } from 'lucide-react';
import './AnalyticsDashboard.css';

interface AnalyticsDashboardProps {
  releases: any[];
}

export default function AnalyticsDashboard({ releases }: AnalyticsDashboardProps) {
  const analytics = useMemo(() => {
    const totalReleases = releases.length;
    const totalFiles = releases.reduce((sum, r) => sum + (r.files?.length || 0), 0);

    // Calculate total size
    const totalSize = releases.reduce((sum, r) => {
      return sum + (r.files?.reduce((s: number, f: any) => s + (f.size || 0), 0) || 0);
    }, 0);

    // Group by Minecraft version
    const mcVersions: Record<string, number> = {};
    releases.forEach(r => {
      const version = r.minecraft_version || 'Unknown';
      mcVersions[version] = (mcVersions[version] || 0) + 1;
    });

    // Most recent release
    const sortedReleases = [...releases].sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    const latestRelease = sortedReleases[0];

    // Calculate average file size
    const avgFileSize = totalFiles > 0 ? totalSize / totalFiles : 0;

    // Calculate release timeline
    const releasesByMonth: Record<string, number> = {};
    releases.forEach(r => {
      if (r.created_at) {
        const month = new Date(r.created_at).toISOString().slice(0, 7);
        releasesByMonth[month] = (releasesByMonth[month] || 0) + 1;
      }
    });

    return {
      totalReleases,
      totalFiles,
      totalSize,
      avgFileSize,
      mcVersions,
      latestRelease,
      releasesByMonth,
    };
  }, [releases]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2>
          <BarChart size={24} /> Release Analytics
        </h2>
        <p>Overview of your modpack releases and statistics</p>
      </div>

      <div className="analytics-grid">
        {/* Total Releases */}
        <div className="analytics-card">
          <div className="analytics-card-icon releases">
            <Package size={24} />
          </div>
          <div className="analytics-card-content">
            <div className="analytics-card-value">{analytics.totalReleases}</div>
            <div className="analytics-card-label">Total Releases</div>
          </div>
        </div>

        {/* Total Files */}
        <div className="analytics-card">
          <div className="analytics-card-icon files">
            <TrendingUp size={24} />
          </div>
          <div className="analytics-card-content">
            <div className="analytics-card-value">{analytics.totalFiles}</div>
            <div className="analytics-card-label">Total Files</div>
          </div>
        </div>

        {/* Total Size */}
        <div className="analytics-card">
          <div className="analytics-card-icon size">
            <Download size={24} />
          </div>
          <div className="analytics-card-content">
            <div className="analytics-card-value">{formatSize(analytics.totalSize)}</div>
            <div className="analytics-card-label">Total Size</div>
          </div>
        </div>

        {/* Average File Size */}
        <div className="analytics-card">
          <div className="analytics-card-icon avg">
            <BarChart size={24} />
          </div>
          <div className="analytics-card-content">
            <div className="analytics-card-value">{formatSize(analytics.avgFileSize)}</div>
            <div className="analytics-card-label">Avg File Size</div>
          </div>
        </div>
      </div>

      {/* Latest Release */}
      {analytics.latestRelease && (
        <div className="analytics-section">
          <h3>
            <Calendar size={20} /> Latest Release
          </h3>
          <div className="latest-release-card">
            <div className="latest-release-header">
              <span className="latest-release-version">{analytics.latestRelease.version}</span>
              <span className="latest-release-date">
                {new Date(analytics.latestRelease.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="latest-release-details">
              <div className="latest-release-detail">
                <span className="detail-label">Minecraft:</span>
                <span className="detail-value">{analytics.latestRelease.minecraft_version || 'N/A'}</span>
              </div>
              <div className="latest-release-detail">
                <span className="detail-label">Fabric:</span>
                <span className="detail-value">{analytics.latestRelease.fabric_loader || 'N/A'}</span>
              </div>
              <div className="latest-release-detail">
                <span className="detail-label">Files:</span>
                <span className="detail-value">{analytics.latestRelease.files?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minecraft Versions Distribution */}
      <div className="analytics-section">
        <h3>Minecraft Versions</h3>
        <div className="analytics-chart">
          {Object.entries(analytics.mcVersions)
            .sort(([, a], [, b]) => b - a)
            .map(([version, count]) => {
              const percentage = (count / analytics.totalReleases) * 100;
              return (
                <div key={version} className="chart-bar-item">
                  <div className="chart-bar-label">
                    <span>{version}</span>
                    <span>{count} release{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="chart-bar-container">
                    <div
                      className="chart-bar-fill"
                      style={{ width: `${percentage}%` }}
                    >
                      <span className="chart-bar-percentage">{percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Release Timeline */}
      <div className="analytics-section">
        <h3>Release Timeline</h3>
        <div className="analytics-chart">
          {Object.entries(analytics.releasesByMonth)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 12)
            .map(([month, count]) => {
              const maxCount = Math.max(...Object.values(analytics.releasesByMonth));
              const percentage = (count / maxCount) * 100;
              const date = new Date(month + '-01');
              const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

              return (
                <div key={month} className="chart-bar-item">
                  <div className="chart-bar-label">
                    <span>{monthName}</span>
                    <span>{count} release{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="chart-bar-container">
                    <div
                      className="chart-bar-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
