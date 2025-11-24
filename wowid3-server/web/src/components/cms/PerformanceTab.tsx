import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useCms } from '@/hooks/useCms';

export function PerformanceTab() {
  const { config, setConfig } = useCms();

  if (!config) return null;

  const updatePerformance = (field: string, value: number) => {
    setConfig({
      ...config,
      performance: {
        ...config.performance,
        [field]: value,
      },
    });
  };

  const updatePolling = (field: string, value: number) => {
    setConfig({
      ...config,
      performance: {
        ...config.performance,
        pollingIntervals: {
          ...config.performance.pollingIntervals,
          [field]: value,
        },
      },
    });
  };

  const updateRetry = (field: string, value: number) => {
    setConfig({
      ...config,
      performance: {
        ...config.performance,
        retryConfig: {
          ...config.performance.retryConfig,
          [field]: value,
        },
      },
    });
  };

  const updateDownload = (field: string, value: number) => {
    setConfig({
      ...config,
      performance: {
        ...config.performance,
        downloadConfig: {
          ...config.performance.downloadConfig,
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Performance Settings</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure resource allocation and system behavior
        </p>
      </div>

      {/* RAM Settings */}
      <div>
        <h4 className="font-medium mb-4">Memory Allocation</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="defaultRam">Default RAM (MB)</Label>
            <Input
              id="defaultRam"
              type="number"
              value={config.performance.defaultRamMb}
              onChange={(e) => updatePerformance('defaultRamMb', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minRam">Minimum RAM (MB)</Label>
            <Input
              id="minRam"
              type="number"
              value={config.performance.minRamMb}
              onChange={(e) => updatePerformance('minRamMb', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxRam">Maximum RAM (MB)</Label>
            <Input
              id="maxRam"
              type="number"
              value={config.performance.maxRamMb}
              onChange={(e) => updatePerformance('maxRamMb', parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Polling Intervals */}
      <div>
        <h4 className="font-medium mb-4">Polling Intervals (milliseconds)</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="serverStatus">Server Status</Label>
            <Input
              id="serverStatus"
              type="number"
              value={config.performance.pollingIntervals.serverStatus}
              onChange={(e) => updatePolling('serverStatus', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trackerStatus">Tracker Status</Label>
            <Input
              id="trackerStatus"
              type="number"
              value={config.performance.pollingIntervals.trackerStatus}
              onChange={(e) => updatePolling('trackerStatus', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="healthCheck">Health Check</Label>
            <Input
              id="healthCheck"
              type="number"
              value={config.performance.pollingIntervals.healthCheck}
              onChange={(e) => updatePolling('healthCheck', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="updateCheck">Update Check</Label>
            <Input
              id="updateCheck"
              type="number"
              value={config.performance.pollingIntervals.updateCheck}
              onChange={(e) => updatePolling('updateCheck', parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Retry Configuration */}
      <div>
        <h4 className="font-medium mb-4">Retry Configuration</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxAttempts">Max Attempts</Label>
            <Input
              id="maxAttempts"
              type="number"
              value={config.performance.retryConfig.maxAttempts}
              onChange={(e) => updateRetry('maxAttempts', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseDelay">Base Delay (ms)</Label>
            <Input
              id="baseDelay"
              type="number"
              value={config.performance.retryConfig.baseDelay}
              onChange={(e) => updateRetry('baseDelay', parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Download Configuration */}
      <div>
        <h4 className="font-medium mb-4">Download Configuration</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxConcurrent">Max Concurrent Downloads</Label>
            <Input
              id="maxConcurrent"
              type="number"
              value={config.performance.downloadConfig.maxConcurrent}
              onChange={(e) => updateDownload('maxConcurrent', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chunkSize">Chunk Size (bytes)</Label>
            <Input
              id="chunkSize"
              type="number"
              value={config.performance.downloadConfig.chunkSize}
              onChange={(e) => updateDownload('chunkSize', parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
