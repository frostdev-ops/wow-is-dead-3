import { FC, useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { useSettingsStore } from '../stores/settingsStore';

interface VpnSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assignedIp: string) => void;
  onError: (error: string) => void;
}

type SetupStep = 'intro' | 'generating' | 'registering' | 'configuring' | 'success' | 'error';

export const VpnSetupModal: FC<VpnSetupModalProps> = ({ isOpen, onClose, onSuccess, onError }) => {
  const [step, setStep] = useState<SetupStep>('intro');
  const [assignedIp, setAssignedIp] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isWindows, setIsWindows] = useState<boolean>(false);
  const [isLinux, setIsLinux] = useState<boolean>(false);
  const [isInstallingWg, setIsInstallingWg] = useState<boolean>(false);

  // Detect OS on mount
  useEffect(() => {
    const detectOS = async () => {
      const platform = await import('@tauri-apps/plugin-os');
      const osType = platform.type();
      setIsWindows(osType === 'windows');
      setIsLinux(osType === 'linux');
    };
    detectOS();
  }, []);

  const handleInstallWireGuard = async () => {
    try {
      setIsInstallingWg(true);
      const { invoke } = await import('@tauri-apps/api/core');

      console.log('[VPN Setup] Launching WireGuard installer...');
      await invoke('vpn_install_wireguard_windows');
      console.log('[VPN Setup] Installer completed');

      // Wait a moment for installation to complete, then retry setup
      setTimeout(() => {
        setIsInstallingWg(false);
        setStep('intro');
        setErrorMessage('');
      }, 2000);
    } catch (err) {
      console.error('[VPN Setup] Failed to install WireGuard:', err);
      setIsInstallingWg(false);
      setErrorMessage(`Failed to launch installer: ${err}`);
    }
  };

  const handleStartSetup = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Step 0: Check if WireGuard is installed
      console.log('[VPN Setup] Checking if WireGuard is installed...');
      const isInstalled = await invoke<boolean>('vpn_check_wireguard_installed');

      if (!isInstalled) {
        // WireGuard is not installed
        const platform = await import('@tauri-apps/plugin-os');
        const osType = platform.type();
        const isWin = osType === 'windows';
        setIsWindows(isWin);

        let errorMsg = 'WireGuard is not installed on your system.';

        if (osType === 'linux') {
          errorMsg += '\n\nPlease install WireGuard using your package manager:\n\n' +
                      'Arch/Manjaro: sudo pacman -S wireguard-tools\n' +
                      'Ubuntu/Debian: sudo apt install wireguard-tools\n' +
                      'Fedora: sudo dnf install wireguard-tools\n\n' +
                      'After installation, restart the launcher and try again.';
        } else if (isWin) {
          errorMsg += '\n\nClick "Install WireGuard" below to run the bundled installer.';
        }

        console.error('[VPN Setup] WireGuard not installed');
        setErrorMessage(errorMsg);
        setStep('error');
        onError(errorMsg);
        return;
      }

      // Step 1: Generate keypair
      setStep('generating');
      console.log('[VPN Setup] Starting keypair generation...');
      const [privateKey, publicKey] = await invoke<[string, string]>('vpn_generate_keypair');
      console.log('[VPN Setup] Keypair generated successfully');

      // Step 2: Register with server
      setStep('registering');
      const manifestUrl = useSettingsStore.getState().manifestUrl;
      console.log('[VPN Setup] Registering with server:', manifestUrl);
      const registrationResult = await invoke<{ success: boolean; assigned_ip: string; server_public_key: string; endpoint: string }>('vpn_register_with_server', {
        publicKey,
        manifestUrl,
      });
      console.log('[VPN Setup] Registration result:', registrationResult);

      if (!registrationResult.success) {
        throw new Error('Failed to register with VPN server');
      }

      // Step 3: Write WireGuard config
      setStep('configuring');
      console.log('[VPN Setup] Writing WireGuard config...');
      await invoke('vpn_write_config', {
        privateKey,
        assignedIp: registrationResult.assigned_ip,
        serverPublicKey: registrationResult.server_public_key,
        endpoint: registrationResult.endpoint,
      });
      console.log('[VPN Setup] Config written successfully');

      // Step 4: Success
      setAssignedIp(registrationResult.assigned_ip);
      setStep('success');
      onSuccess(registrationResult.assigned_ip);
    } catch (err) {
      console.error('[VPN Setup] Error occurred:', err);
      console.error('[VPN Setup] Error type:', typeof err);
      console.error('[VPN Setup] Error details:', JSON.stringify(err, null, 2));

      let message = 'Unknown error occurred';
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }

      console.error('[VPN Setup] Final error message:', message);
      setErrorMessage(message);
      setStep('error');
      onError(message);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <>
            <Modal.Body>
              <div className="space-y-4">
                <p className="text-gray-300">
                  The VPN tunnel helps reduce lag and packet loss by routing your connection through a private network.
                </p>
                <div className="bg-blue-900 bg-opacity-20 border border-blue-500 border-opacity-30 rounded p-4">
                  <h4 className="text-blue-400 font-semibold mb-2">What will happen:</h4>
                  <ol className="list-decimal list-inside text-gray-300 space-y-1 text-sm">
                    <li>Generate a secure encryption key pair for your device</li>
                    <li>Register your Minecraft account with the VPN server</li>
                    <li>Configure WireGuard tunnel on your system</li>
                  </ol>
                </div>
                <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 border-opacity-30 rounded p-4">
                  <p className="text-yellow-400 text-sm">
                    <strong>⚠️ Prerequisites:</strong>
                  </p>

                  {isWindows && (
                    <div className="mt-2">
                      <p className="text-gray-300 text-sm">
                        <strong>Windows:</strong> WireGuard installer is bundled with this launcher. If WireGuard is not installed, you'll be prompted to install it.
                      </p>
                    </div>
                  )}

                  {isLinux && (
                    <div className="mt-2">
                      <p className="text-gray-300 text-sm">
                        <strong>Linux:</strong> You must install WireGuard first:
                      </p>
                      <code className="text-xs bg-gray-800 px-2 py-1 rounded mt-2 block">
                        Arch/Manjaro: sudo pacman -S wireguard-tools<br />
                        Ubuntu/Debian: sudo apt install wireguard-tools<br />
                        Fedora: sudo dnf install wireguard-tools
                      </code>
                      <p className="text-gray-400 text-xs mt-2">
                        <strong>Note:</strong> Starting/stopping the VPN will prompt for your password (via pkexec). This is normal and required for network operations.
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        For passwordless operation, configure sudo:
                        <code className="text-xs bg-gray-800 px-2 py-1 rounded mt-1 block">
                          sudo visudo -f /etc/sudoers.d/wowid3-vpn<br />
                          Add: {'{'}username{'}'} ALL=(ALL) NOPASSWD: /usr/bin/wg-quick
                        </code>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button onClick={onClose} variant="secondary">
                Cancel
              </Button>
              <Button onClick={handleStartSetup} variant="primary">
                Start Setup
              </Button>
            </Modal.Footer>
          </>
        );

      case 'generating':
      case 'registering':
      case 'configuring':
        return (
          <Modal.Body>
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-300 text-lg">
                {step === 'generating' && 'Generating encryption keys...'}
                {step === 'registering' && 'Registering with VPN server...'}
                {step === 'configuring' && 'Configuring WireGuard tunnel...'}
              </p>
              <p className="text-gray-500 text-sm">Please wait, this should only take a moment.</p>
            </div>
          </Modal.Body>
        );

      case 'success':
        return (
          <>
            <Modal.Body>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-500 bg-opacity-20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">VPN Setup Complete!</h3>
                <p className="text-gray-300 text-center">
                  Your VPN has been configured successfully.
                  <br />
                  Assigned IP: <span className="text-blue-400 font-mono">{assignedIp}</span>
                </p>
                <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 border-opacity-30 rounded p-4 w-full">
                  <p className="text-yellow-400 text-sm">
                    <strong>Next Steps:</strong> The VPN tunnel will start automatically when you launch the game. You can disable it anytime in Settings.
                  </p>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button onClick={onClose} variant="primary">
                Done
              </Button>
            </Modal.Footer>
          </>
        );

      case 'error':
        return (
          <>
            <Modal.Body>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-red-500 bg-opacity-20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Setup Failed</h3>
                <p className="text-gray-300 text-center">
                  An error occurred during VPN setup:
                </p>
                <div className="bg-red-900 bg-opacity-20 border border-red-500 border-opacity-30 rounded p-4 w-full">
                  <p className="text-red-400 text-sm font-mono">{errorMessage}</p>
                </div>
                <p className="text-gray-400 text-sm text-center">
                  Please try again. If the problem persists, check that WireGuard is installed and you have an active internet connection.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              {isWindows && errorMessage.includes('not installed') && (
                <Button
                  onClick={handleInstallWireGuard}
                  variant="primary"
                  disabled={isInstallingWg}
                >
                  {isInstallingWg ? 'Installing...' : 'Install WireGuard'}
                </Button>
              )}
              <Button onClick={() => setStep('intro')} variant="secondary">
                Try Again
              </Button>
              <Button onClick={onClose} variant="primary">
                Close
              </Button>
            </Modal.Footer>
          </>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={step === 'generating' || step === 'registering' || step === 'configuring' ? () => {} : onClose} size="md">
      <Modal.Header>
        <Modal.Title>VPN Setup</Modal.Title>
      </Modal.Header>
      {renderContent()}
    </Modal>
  );
};
