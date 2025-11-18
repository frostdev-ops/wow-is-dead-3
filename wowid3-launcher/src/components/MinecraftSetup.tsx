import { motion, AnimatePresence } from 'framer-motion';
import { useMinecraftInstaller } from '../hooks';
import { Card } from './ui/Card';
import { INSTALL_STEP_LABELS } from '../types/minecraft';

export function MinecraftSetup() {
  const {
    selectedVersion,
    isInstalled,
    isInstalling,
    installProgress,
    install,
    error,
    clearError,
  } = useMinecraftInstaller();

  const handleInstall = async () => {
    await install();
  };

  // Calculate progress percentage
  const progressPercentage =
    installProgress && installProgress.total > 0
      ? Math.round((installProgress.current / installProgress.total) * 100)
      : 0;

  // Format bytes to MB
  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card borderColor="rgba(22, 163, 74, 0.8)" glowColor="rgba(22, 163, 74, 0.3)">
        <div className="text-center mb-6">
          <p
            className="text-lg"
            style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}
          >
            Get started with Directory Setup
          </p>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-4 p-3"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                border: '1px solid rgba(220, 38, 38, 0.8)',
                borderRadius: '8px',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-red-300" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>
                  {error}
                </span>
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-300"
                  style={{ fontFamily: "'Trebuchet MS', sans-serif" }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Bar (during installation) */}
        <AnimatePresence>
          {isInstalling && installProgress && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <div className="mb-2 flex items-center justify-between">
                <motion.span
                  key={installProgress.step}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-semibold"
                  style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}
                >
                  {INSTALL_STEP_LABELS[installProgress.step as keyof typeof INSTALL_STEP_LABELS] ||
                    installProgress.message}
                </motion.span>
                <motion.span
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-sm font-semibold"
                  style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }}
                >
                  {progressPercentage}%
                </motion.span>
              </div>

              {/* Progress Bar */}
              <div
                className="w-full h-4 overflow-hidden mb-2"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '8px',
                }}
              >
                <motion.div
                  className="h-full"
                  style={{
                    background: 'repeating-linear-gradient(45deg, #ffffff, #ffffff 10px, #ff0000 10px, #ff0000 20px)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>

              {/* Progress Details */}
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
                  {installProgress.current} / {installProgress.total} files
                </span>
                <span style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
                  {formatMB(installProgress.current_bytes)} MB / {formatMB(installProgress.total_bytes)} MB
                </span>
              </div>

              {/* Special note for assets */}
              <AnimatePresence>
                {installProgress.step === 'assets' && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs mt-2 text-center"
                    style={{ color: '#fde047', fontFamily: "'Trebuchet MS', sans-serif" }}
                  >
                    ⏳ Downloading assets can take 2-5 minutes (4000+ files)
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Install Button */}
        <AnimatePresence>
          {!isInstalling && !isInstalled && selectedVersion && (
            <div className="flex justify-center">
              <motion.button
                onClick={handleInstall}
                disabled={!selectedVersion}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="py-4 px-12 text-xl font-bold transition-all"
                style={{
                  backgroundColor: selectedVersion ? 'rgba(255, 215, 0, 0.3)' : 'rgba(128, 128, 128, 0.5)',
                  color: selectedVersion ? '#FFD700' : '#666',
                  border: selectedVersion ? '2px solid rgba(255, 215, 0, 0.8)' : '2px solid rgba(128, 128, 128, 0.8)',
                  borderRadius: '8px',
                  boxShadow: selectedVersion ? '0 0 20px rgba(255, 215, 0, 0.3)' : 'none',
                  fontFamily: "'Trebuchet MS', sans-serif",
                  cursor: selectedVersion ? 'pointer' : 'not-allowed',
                }}
              >
                Install
              </motion.button>
            </div>
          )}
        </AnimatePresence>

        {/* Advanced Options Link */}
        <div className="mt-4 text-center">
          <p className="text-sm" style={{ color: '#c6ebdaff', fontFamily: "'Trebuchet MS', sans-serif" }}>
            Need to configure RAM or Install location?{' '}
            <span style={{ color: '#FFD700', fontFamily: "'Trebuchet MS', sans-serif" }} className="hover:opacity-80 cursor-pointer transition-opacity">
              Go to Settings for advanced options
            </span>
          </p>
        </div>

        {/* Installation Status / Progress */}
        <AnimatePresence mode="wait">
          {!isInstalling && selectedVersion && (
            <motion.div
              key={isInstalled ? "installed" : "not-installed"}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="mt-6 p-3 text-center"
              style={{
                backgroundColor: isInstalled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                border: `1px solid ${isInstalled ? 'rgba(34, 197, 94, 0.8)' : 'rgba(220, 38, 38, 0.8)'}`,
                borderRadius: '8px',
                maxWidth: isInstalled ? '100%' : '400px',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <motion.span
                initial={{ x: -10 }}
                animate={{ x: 0 }}
                className="text-sm"
                style={{
                  color: isInstalled ? '#86efac' : '#fca5a5',
                  fontFamily: "'Trebuchet MS', sans-serif",
                }}
              >
                {isInstalled
                  ? '✓ This version is installed and ready to play'
                  : '⚠ Default install location recommended'}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
