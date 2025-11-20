import { FC } from 'react';

interface SecureAvatarProps {
  username: string;
  uuid?: string; // Optional UUID for better avatar fetching
  className?: string;
  alt?: string;
  onError?: () => void;
}

/**
 * Displays a 2D head avatar for the player
 * Uses Crafatar which provides rendered head-only images
 */
export const SecureAvatar: FC<SecureAvatarProps> = ({ username, uuid, className = '', alt = '' }) => {
  // Use Crafatar for head-only avatar (returns 2D rendered isometric head)
  // If UUID is available, use it (more reliable), otherwise use username
  // Size 128 provides good quality for the UI, overlay includes second layer (hats, etc.)
  const identifier = uuid || username;
  const endpoint = uuid ? 'avatars' : 'avatars';  // Both work with UUID or username
  const avatarUrl = `https://crafatar.com/${endpoint}/${identifier}?size=128&overlay`;

  return (
    <img
      src={avatarUrl}
      alt={alt || username}
      className={className}
      onError={(e) => {
        // Fallback to default avatar on error
        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect fill="%23444" width="128" height="128"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-size="48">?</text></svg>';
      }}
    />
  );
};