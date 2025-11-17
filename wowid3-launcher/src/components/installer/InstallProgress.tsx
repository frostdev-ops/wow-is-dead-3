import { useMinecraftInstaller } from '../../hooks';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { INSTALL_STEP_LABELS } from '../../types/minecraft';

export function InstallProgress() {
  const {
    isInstalling,
    installProgress,
    install,
    selectedVersion,
    fabricEnabled,
    isInstalled,
  } = useMinecraftInstaller();

  const progressPercentage = installProgress
    ? Math.round((installProgress.current / installProgress.total) * 100)
    : 0;

  const getStepLabel = (step: string): string => {
    return INSTALL_STEP_LABELS[step as keyof typeof INSTALL_STEP_LABELS] || step;
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold mb-4" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>
        Installation
      </h2>

      {/* Install Button */}
      {!isInstalling && !isInstalled && (
        <div className="mb-4">
          <Button
            variant="primary"
            size="lg"
            onClick={install}
            disabled={!selectedVersion || isInstalling}
            style={{ width: '100%' }}
          >
            {fabricEnabled ? 'Install Minecraft with Fabric' : 'Install Minecraft'}
          </Button>
          <p className="text-xs mt-2" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            This will download Minecraft {selectedVersion}{fabricEnabled ? ' with Fabric mod loader' : ''}
          </p>
        </div>
      )}

      {/* Already Installed Message */}
      {isInstalled && !isInstalling && (
        <div className="mb-4 p-4" style={{
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          border: '1px solid rgba(34, 197, 94, 0.8)',
          borderRadius: '0',
        }}>
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>
              <p className="font-bold" style={{ color: '#86efac', fontFamily: "'Trebuchet MS', sans-serif" }}>
                Ready to Play!
              </p>
              <p className="text-sm" style={{ color: '#86efac', fontFamily: "'Trebuchet MS', sans-serif" }}>
                {selectedVersion} is installed and ready
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Display */}
      {isInstalling && installProgress && (
        <div className="space-y-4">
          {/* Current Step */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
              {getStepLabel(installProgress.step)}
            </p>
            <p className="text-xs" style={{ color: '#fff', fontFamily: "'Trebuchet MS', sans-serif" }}>
              {installProgress.message}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full" style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '0',
            height: '32px',
            overflow: 'hidden',
          }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progressPercentage}%`,
                backgroundColor: 'rgba(255, 215, 0, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="text-black font-bold text-sm" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
                {progressPercentage}%
              </span>
            </div>
          </div>

          {/* Progress Details */}
          <div className="space-y-2 text-xs" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            <div className="flex justify-between">
              <span>
                {installProgress.current} / {installProgress.total} files
              </span>
              <span>{progressPercentage}% complete</span>
            </div>
            {installProgress.total_bytes > 0 && (
              <div className="flex justify-between" style={{ color: '#fff', fontSize: '0.75rem' }}>
                <span>
                  {(installProgress.current_bytes / (1024 * 1024)).toFixed(1)} / {(installProgress.total_bytes / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
            )}
          </div>

          {/* Note for Assets Step */}
          {installProgress.step === 'assets' && (
            <div className="p-3" style={{
              backgroundColor: 'rgba(234, 179, 8, 0.2)',
              border: '1px solid rgba(234, 179, 8, 0.8)',
              borderRadius: '0',
            }}>
              <p className="text-xs" style={{ color: '#fde047', fontFamily: "'Trebuchet MS', sans-serif" }}>
                ⏳ Downloading assets can take 2-5 minutes (4000+ files). Please be patient!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Installing State (No Progress Yet) */}
      {isInstalling && !installProgress && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="mb-4">
              <svg className="animate-spin h-12 w-12 mx-auto" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}>
              Initializing installation...
            </p>
          </div>
        </div>
      )}

      {/* Reinstall Option */}
      {isInstalled && !isInstalling && (
        <Button
          variant="outline"
          size="md"
          onClick={install}
          style={{ width: '100%' }}
        >
          Reinstall
        </Button>
      )}
    </Card>
  );
}
