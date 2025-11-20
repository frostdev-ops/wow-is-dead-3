import { FC } from 'react';
import { motion } from 'framer-motion';
import { ANIMATION_CONFIG } from '../../config/constants';

export enum PlayButtonState {
  AUTHENTICATING = 'AUTHENTICATING',
  LAUNCHING = 'LAUNCHING',
  PLAYING = 'PLAYING',
  INSTALLING = 'INSTALLING',
  UPDATING = 'UPDATING',
  LOGIN_REQUIRED = 'LOGIN_REQUIRED',
  UPDATE_AVAILABLE = 'UPDATE_AVAILABLE',
  READY = 'READY',
}

export interface PlayButtonProps {
  state: PlayButtonState;
  onClick: () => void | Promise<void>;
  className?: string;
}

const getButtonConfig = (state: PlayButtonState) => {
  switch (state) {
    case PlayButtonState.AUTHENTICATING:
      return { text: 'Authenticating...', disabled: true };
    case PlayButtonState.LAUNCHING:
      return { text: 'Launching...', disabled: true };
    case PlayButtonState.PLAYING:
      return { text: 'Playing!', disabled: true };
    case PlayButtonState.INSTALLING:
      return { text: 'Installing/Updating...', disabled: true };
    case PlayButtonState.UPDATING:
      return { text: 'Updating...', disabled: true };
    case PlayButtonState.LOGIN_REQUIRED:
      return { text: 'Login', disabled: false };
    case PlayButtonState.UPDATE_AVAILABLE:
      return { text: 'Update', disabled: false };
    case PlayButtonState.READY:
      return { text: 'PLAY', disabled: false };
    default:
      return { text: 'PLAY', disabled: false };
  }
};

export const PlayButton: FC<PlayButtonProps> = ({ state, onClick, className = '' }) => {
  const config = getButtonConfig(state);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
      className="flex justify-center mt-6"
    >
      <motion.button
        onClick={onClick}
        disabled={config.disabled}
        className={`btn-primary text-2xl py-8 px-16 disabled:opacity-50 disabled:cursor-not-allowed btn-gradient-border ${className}`}
        whileHover={config.disabled ? undefined : { scale: 1.05 }}
        whileTap={config.disabled ? undefined : { scale: 0.95 }}
        transition={ANIMATION_CONFIG.SPRING}
      >
        {config.text}
      </motion.button>
    </motion.div>
  );
};

/**
 * Helper hook to determine the play button state from component props
 */
export const usePlayButtonState = ({
  authLoading,
  isLaunching,
  isPlaying,
  isBlockedForInstall,
  isDownloading,
  isAuthenticated,
  updateAvailable,
}: {
  authLoading: boolean;
  isLaunching: boolean;
  isPlaying: boolean;
  isBlockedForInstall: boolean;
  isDownloading: boolean;
  isAuthenticated: boolean;
  updateAvailable: boolean;
}): PlayButtonState => {
  // Priority order (highest to lowest)
  if (authLoading) return PlayButtonState.AUTHENTICATING;
  if (isLaunching) return PlayButtonState.LAUNCHING;
  if (isPlaying) return PlayButtonState.PLAYING;
  if (isBlockedForInstall) return PlayButtonState.INSTALLING;
  if (isDownloading) return PlayButtonState.UPDATING;
  if (!isAuthenticated) return PlayButtonState.LOGIN_REQUIRED;
  if (updateAvailable) return PlayButtonState.UPDATE_AVAILABLE;
  return PlayButtonState.READY;
};