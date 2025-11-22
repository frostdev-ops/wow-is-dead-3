import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  useNetworkTestStore,
  NetworkTestResult,
  NetworkTestProgress,
  LatencyTestResult,
  SpeedTestResult,
  PacketLossResult,
} from '../stores/networkTestStore';

export const useNetworkTest = () => {
  const {
    isRunning,
    currentTest,
    progress,
    latestResult,
    testHistory,
    error,
    canRunTest,
    setRunning,
    setProgress,
    setResult,
    setError,
    clearError,
    clearResults,
    exportResults,
  } = useNetworkTestStore();

  // Listen for progress events
  useEffect(() => {
    const unlisten = listen<NetworkTestProgress>(
      'network-test-progress',
      (event) => {
        setProgress(event.payload);
      }
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setProgress]);

  const testGameServerReachability = useCallback(async (): Promise<[boolean, number | null]> => {
    try {
      const result = await invoke<[boolean, number | null]>('test_game_server_reachability');
      return result;
    } catch (err) {
      throw new Error(err as string);
    }
  }, []);

  const testLatencyAndJitter = useCallback(
    async (packetCount: number = 30): Promise<LatencyTestResult> => {
      try {
        const result = await invoke<LatencyTestResult>('test_latency_and_jitter', {
          packetCount,
        });
        return result;
      } catch (err) {
        throw new Error(err as string);
      }
    },
    []
  );

  const testDownloadSpeed = useCallback(
    async (durationSecs: number = 15): Promise<SpeedTestResult> => {
      try {
        const result = await invoke<SpeedTestResult>('test_download_speed', {
          durationSecs,
        });
        return result;
      } catch (err) {
        throw new Error(err as string);
      }
    },
    []
  );

  const testUploadSpeed = useCallback(
    async (durationSecs: number = 15): Promise<SpeedTestResult> => {
      try {
        const result = await invoke<SpeedTestResult>('test_upload_speed', {
          durationSecs,
        });
        return result;
      } catch (err) {
        throw new Error(err as string);
      }
    },
    []
  );

  const testPacketLoss = useCallback(
    async (packetCount: number = 50): Promise<PacketLossResult> => {
      try {
        const result = await invoke<PacketLossResult>('test_packet_loss', {
          packetCount,
        });
        return result;
      } catch (err) {
        throw new Error(err as string);
      }
    },
    []
  );

  const runFullNetworkAnalysis = useCallback(async (): Promise<void> => {
    if (!canRunTest()) {
      setError('Please wait 1 minute between tests');
      return;
    }

    clearError();
    setRunning(true, 'full_analysis');

    try {
      const result = await invoke<NetworkTestResult>('run_full_network_analysis');
      setResult(result);
    } catch (err) {
      setError(err as string);
    } finally {
      setRunning(false);
    }
  }, [canRunTest, clearError, setRunning, setResult, setError]);

  const runIndividualTest = useCallback(
    async (
      testName: string,
      testFunction: () => Promise<any>
    ): Promise<void> => {
      clearError();
      setRunning(true, testName);

      try {
        await testFunction();
      } catch (err) {
        setError(err as string);
      } finally {
        setRunning(false);
      }
    },
    [clearError, setRunning, setError]
  );

  const downloadTestResult = useCallback(() => {
    if (!latestResult) return;

    const dataStr = exportResults();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network-test-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [latestResult, exportResults]);

  return {
    // State
    isRunning,
    currentTest,
    progress,
    latestResult,
    testHistory,
    error,
    canRunTest: canRunTest(),

    // Individual test functions
    testGameServerReachability,
    testLatencyAndJitter,
    testDownloadSpeed,
    testUploadSpeed,
    testPacketLoss,

    // Full analysis
    runFullNetworkAnalysis,
    runIndividualTest,

    // Utility functions
    clearError,
    clearResults,
    downloadTestResult,
  };
};
