import { useState } from 'react';
import { useNetworkTest } from '../hooks/useNetworkTest';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { LoadingSpinner } from './ui/LoadingSpinner';

interface TestCardProps {
  title: string;
  icon: string;
  status: 'idle' | 'running' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}

const TestCard: React.FC<TestCardProps> = ({ title, icon, status, children }) => {
  const statusColors = {
    idle: 'border-gray-600',
    running: 'border-blue-500',
    success: 'border-green-500',
    warning: 'border-yellow-500',
    error: 'border-red-500',
  };

  const statusIcons = {
    idle: '',
    running: '⏳',
    success: '✓',
    warning: '⚠',
    error: '✗',
  };

  return (
    <Card className={`border-2 ${statusColors[status]} transition-colors`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {status !== 'idle' && (
          <span className="text-2xl">{statusIcons[status]}</span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
};

const ResultRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between text-sm">
    <span className="text-gray-400">{label}:</span>
    <span className="font-medium">{value}</span>
  </div>
);

const getLatencyStatus = (latency_ms?: number | null): 'success' | 'warning' | 'error' => {
  if (!latency_ms) return 'error';
  if (latency_ms < 50) return 'success';
  if (latency_ms < 100) return 'warning';
  return 'error';
};

const getSpeedStatus = (mbps?: number, isDownload: boolean = true): 'success' | 'warning' | 'error' => {
  if (!mbps) return 'error';
  const threshold = isDownload ? 10 : 5;
  const warningThreshold = isDownload ? 5 : 2;

  if (mbps >= threshold) return 'success';
  if (mbps >= warningThreshold) return 'warning';
  return 'error';
};

const getPacketLossStatus = (lossPercent?: number): 'success' | 'warning' | 'error' => {
  if (lossPercent === undefined) return 'error';
  if (lossPercent < 1) return 'success';
  if (lossPercent < 5) return 'warning';
  return 'error';
};

export const NetworkTest: React.FC = () => {
  const {
    isRunning,
    currentTest,
    progress,
    latestResult,
    testHistory,
    error,
    canRunTest,
    runFullNetworkAnalysis,
    clearError,
    clearResults,
    downloadTestResult,
  } = useNetworkTest();

  const [showHistory, setShowHistory] = useState(false);

  const handleRunTest = async () => {
    if (!canRunTest) {
      return;
    }
    await runFullNetworkAnalysis();
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatMbps = (mbps: number) => {
    return `${mbps.toFixed(1)} Mbps`;
  };

  const formatMs = (ms: number) => {
    return `${ms.toFixed(0)}ms`;
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1000) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Network Performance Test</h2>
        <p className="text-gray-400 text-sm">
          Test your connection to mc.frostdev.io | Port 25567 (Test Server) | Port 25565 (Game Server)
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-500 bg-red-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-500 text-xl">⚠</span>
              <p className="text-red-400">{error}</p>
            </div>
            <Button onClick={clearError} variant="secondary" size="sm">
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleRunTest}
          disabled={isRunning || !canRunTest}
          className="flex-1"
        >
          {isRunning ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Running Tests...</span>
            </>
          ) : canRunTest ? (
            'Run Full Test'
          ) : (
            'Wait 1 minute...'
          )}
        </Button>

        {latestResult && (
          <>
            <Button onClick={downloadTestResult} variant="secondary">
              Export Results
            </Button>
            <Button onClick={clearResults} variant="secondary">
              Clear
            </Button>
          </>
        )}
      </div>

      {/* Progress Indicator */}
      {isRunning && progress && (
        <Card>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{currentTest?.replace(/_/g, ' ')}</span>
              <span>{progress.progress_percent}%</span>
            </div>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress.progress_percent}%` }}
              />
            </div>
            <p className="text-sm text-gray-400">{progress.current_step}</p>
          </div>
        </Card>
      )}

      {/* Test Results */}
      {latestResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Latest Results</h3>
            <span className="text-sm text-gray-400">
              {formatTimestamp(latestResult.timestamp)}
            </span>
          </div>

          {/* Game Server Reachability */}
          <TestCard
            title="Game Server Connection"
            icon="🎮"
            status={latestResult.game_server_reachable ? 'success' : 'error'}
          >
            {latestResult.game_server_reachable ? (
              <>
                <ResultRow label="Status" value="Connected" />
                {latestResult.game_server_latency_ms && (
                  <ResultRow
                    label="Connection Time"
                    value={formatMs(latestResult.game_server_latency_ms)}
                  />
                )}
                <p className="text-xs text-green-400 mt-2">
                  ✓ mc.frostdev.io:25565 is reachable
                </p>
              </>
            ) : (
              <p className="text-red-400">✗ Cannot reach game server</p>
            )}
          </TestCard>

          {/* Latency & Jitter */}
          {latestResult.latency && (
            <TestCard
              title="Latency & Jitter"
              icon="📊"
              status={getLatencyStatus(latestResult.latency.avg_ms)}
            >
              <ResultRow label="Average" value={formatMs(latestResult.latency.avg_ms)} />
              <ResultRow
                label="Min / Max"
                value={`${formatMs(latestResult.latency.min_ms)} / ${formatMs(latestResult.latency.max_ms)}`}
              />
              <ResultRow label="Jitter" value={formatMs(latestResult.latency.jitter_ms)} />
              <ResultRow label="Samples" value={latestResult.latency.samples} />
              <div className="mt-2 w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    latestResult.latency.avg_ms < 50
                      ? 'bg-green-500'
                      : latestResult.latency.avg_ms < 100
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((latestResult.latency.avg_ms / 200) * 100, 100)}%` }}
                />
              </div>
            </TestCard>
          )}

          {/* Download Speed */}
          {latestResult.download_speed && (
            <TestCard
              title="Download Speed"
              icon="⬇"
              status={getSpeedStatus(latestResult.download_speed.mbps, true)}
            >
              <ResultRow
                label="Speed"
                value={formatMbps(latestResult.download_speed.mbps)}
              />
              <ResultRow
                label="Data Transferred"
                value={formatBytes(latestResult.download_speed.bytes_transferred)}
              />
              <ResultRow
                label="Test Duration"
                value={`${(latestResult.download_speed.duration_ms / 1000).toFixed(1)}s`}
              />
              <div className="mt-2 w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    latestResult.download_speed.mbps >= 10
                      ? 'bg-green-500'
                      : latestResult.download_speed.mbps >= 5
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((latestResult.download_speed.mbps / 50) * 100, 100)}%` }}
                />
              </div>
            </TestCard>
          )}

          {/* Upload Speed */}
          {latestResult.upload_speed && (
            <TestCard
              title="Upload Speed"
              icon="⬆"
              status={getSpeedStatus(latestResult.upload_speed.mbps, false)}
            >
              <ResultRow label="Speed" value={formatMbps(latestResult.upload_speed.mbps)} />
              <ResultRow
                label="Data Transferred"
                value={formatBytes(latestResult.upload_speed.bytes_transferred)}
              />
              <ResultRow
                label="Test Duration"
                value={`${(latestResult.upload_speed.duration_ms / 1000).toFixed(1)}s`}
              />
              <div className="mt-2 w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    latestResult.upload_speed.mbps >= 5
                      ? 'bg-green-500'
                      : latestResult.upload_speed.mbps >= 2
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((latestResult.upload_speed.mbps / 25) * 100, 100)}%` }}
                />
              </div>
            </TestCard>
          )}

          {/* Packet Loss */}
          {latestResult.packet_loss && (
            <TestCard
              title="Packet Loss"
              icon="📦"
              status={getPacketLossStatus(latestResult.packet_loss.loss_percent)}
            >
              <ResultRow
                label="Loss Rate"
                value={`${latestResult.packet_loss.loss_percent.toFixed(1)}%`}
              />
              <ResultRow
                label="Packets Sent"
                value={latestResult.packet_loss.sent}
              />
              <ResultRow
                label="Packets Received"
                value={latestResult.packet_loss.received}
              />
              <ResultRow
                label="Packets Lost"
                value={latestResult.packet_loss.lost}
              />
              {latestResult.packet_loss.loss_percent === 0 ? (
                <p className="text-xs text-green-400 mt-2">
                  ✓ Excellent! No packet loss detected
                </p>
              ) : latestResult.packet_loss.loss_percent < 1 ? (
                <p className="text-xs text-green-400 mt-2">
                  ✓ Good connection quality
                </p>
              ) : latestResult.packet_loss.loss_percent < 5 ? (
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠ Moderate packet loss - may affect gameplay
                </p>
              ) : (
                <p className="text-xs text-red-400 mt-2">
                  ✗ High packet loss - will cause lag and disconnects
                </p>
              )}
            </TestCard>
          )}
        </div>
      )}

      {/* Test History */}
      {testHistory.length > 0 && (
        <div>
          <Button
            onClick={() => setShowHistory(!showHistory)}
            variant="secondary"
            className="w-full"
          >
            {showHistory ? 'Hide' : 'Show'} Test History ({testHistory.length})
          </Button>

          {showHistory && (
            <div className="mt-4 space-y-2">
              {testHistory.map((result, index) => (
                <Card key={index} className="text-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{formatTimestamp(result.timestamp)}</p>
                      <div className="text-xs text-gray-400 mt-1 space-x-3">
                        {result.latency && (
                          <span>Latency: {formatMs(result.latency.avg_ms)}</span>
                        )}
                        {result.download_speed && (
                          <span>Down: {formatMbps(result.download_speed.mbps)}</span>
                        )}
                        {result.upload_speed && (
                          <span>Up: {formatMbps(result.upload_speed.mbps)}</span>
                        )}
                        {result.packet_loss && (
                          <span>Loss: {result.packet_loss.loss_percent.toFixed(1)}%</span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        result.success ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!latestResult && !isRunning && (
        <Card className="text-center py-12">
          <div className="text-6xl mb-4">🌐</div>
          <h3 className="text-xl font-semibold mb-2">No Test Results</h3>
          <p className="text-gray-400 mb-4">
            Click "Run Full Test" to check your network performance
          </p>
          <p className="text-sm text-gray-500">
            Tests download speed, upload speed, latency, jitter, and packet loss
          </p>
        </Card>
      )}
    </div>
  );
};
