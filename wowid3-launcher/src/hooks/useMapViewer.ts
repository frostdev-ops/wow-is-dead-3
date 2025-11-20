import { useState, useCallback, useEffect } from 'react';
import { checkBlueMapAvailable, openMapViewer, closeMapViewer, getBlueMapUrl } from './useTauriCommands';
import type { BlueMapStatus } from './useTauriCommands';

export const useMapViewer = () => {
  const [status, setStatus] = useState<BlueMapStatus>({
    available: false,
    url: '',
    error: null,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [blueMapUrl, setBlueMapUrl] = useState<string>('');

  // Check if BlueMap is available
  const checkAvailability = useCallback(async () => {
    try {
      setIsChecking(true);
      const result = await checkBlueMapAvailable();
      setStatus(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to check BlueMap availability';
      setStatus({
        available: false,
        url: '',
        error,
      });
      return {
        available: false,
        url: '',
        error,
      };
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Get BlueMap URL
  const fetchBlueMapUrl = useCallback(async () => {
    try {
      const url = await getBlueMapUrl();
      setBlueMapUrl(url);
      return url;
    } catch (err) {
      console.error('Failed to get BlueMap URL:', err);
      return '';
    }
  }, []);

  // Open the map viewer window
  const openMap = useCallback(async () => {
    try {
      setIsOpening(true);
      setStatus(prev => ({ ...prev, error: null }));

      // Check availability first
      const currentStatus = await checkBlueMapAvailable();
      if (!currentStatus.available) {
        throw new Error(currentStatus.error || 'BlueMap is not available');
      }

      await openMapViewer();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to open map viewer';
      setStatus(prev => ({ ...prev, error }));
      throw new Error(error);
    } finally {
      setIsOpening(false);
    }
  }, []);

  // Close the map viewer window
  const closeMap = useCallback(async () => {
    try {
      await closeMapViewer();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to close map viewer';
      console.error('Error closing map viewer:', error);
      return false;
    }
  }, []);

  // Check availability on mount
  useEffect(() => {
    checkAvailability();
    fetchBlueMapUrl();
  }, [checkAvailability, fetchBlueMapUrl]);

  return {
    status,
    isChecking,
    isOpening,
    blueMapUrl,
    checkAvailability,
    openMap,
    closeMap,
    isAvailable: status.available,
    error: status.error,
  };
};
