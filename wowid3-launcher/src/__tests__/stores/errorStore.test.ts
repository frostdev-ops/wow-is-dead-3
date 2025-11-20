import { describe, it, expect, beforeEach } from 'vitest';
import { useErrorStore, LauncherErrorCode, LauncherError } from '../../stores/errorStore';

describe('LauncherError System', () => {
  beforeEach(() => {
    useErrorStore.setState({ errors: [] });
  });

  it('should categorize network errors', () => {
    const error = new LauncherError(LauncherErrorCode.NETWORK_OFFLINE, 'Connection lost');
    expect(error.code).toBe(LauncherErrorCode.NETWORK_OFFLINE);
  });

  it('should provide recovery information', () => {
    const error = new LauncherError(LauncherErrorCode.MC_INSTALL_FAILED, 'Disk full', { retryable: true });
    expect(error.retryable).toBe(true);
  });

  it('should generate user-friendly messages', () => {
    const message = 'Something went wrong';
    const error = new LauncherError(LauncherErrorCode.UNKNOWN, message);
    expect(error.message).toBe(message);
  });

  it('should add and clear errors', () => {
    const { addError, clearError, clearAllErrors } = useErrorStore.getState();
    
    const error1 = new LauncherError(
      LauncherErrorCode.AUTH_FAILED,
      'Login failed',
      { retryable: true }
    );

    addError(error1);

    expect(useErrorStore.getState().errors).toHaveLength(1);

    clearError(LauncherErrorCode.AUTH_FAILED);
    expect(useErrorStore.getState().errors).toHaveLength(0);
    
    const error2 = new LauncherError(
        LauncherErrorCode.MC_LAUNCH_FAILED,
        'Crash',
        { retryable: false }
    );
    
    addError(error2);
    clearAllErrors();
    expect(useErrorStore.getState().errors).toHaveLength(0);
  });
});
