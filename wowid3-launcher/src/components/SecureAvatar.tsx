import { useState, useEffect } from 'react';
import { fetchAvatar } from '../hooks/useTauriCommands';

interface SecureAvatarProps {
  username: string;
  className?: string;
  alt?: string;
  onError?: () => void;
}

export const SecureAvatar = ({ username, className = '', alt = '', onError }: SecureAvatarProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadAvatar = async () => {
      try {
        setIsLoading(true);
        setError(false);

        const avatarData = await fetchAvatar(username);
        const blob = new Blob(
          [Uint8Array.from(atob(avatarData.data), c => c.charCodeAt(0))],
          { type: avatarData.content_type }
        );
        const url = URL.createObjectURL(blob);
        setAvatarUrl(url);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Failed to load avatar:', err);
        }
        setError(true);
        onError?.();
      } finally {
        setIsLoading(false);
      }
    };

    loadAvatar();

    // Cleanup blob URL on unmount
    return () => {
      if (avatarUrl) {
        URL.revokeObjectURL(avatarUrl);
      }
    };
  }, [username]);

  if (isLoading) {
    return (
      <div className={`${className} bg-gray-700 animate-pulse`} />
    );
  }

  if (error || !avatarUrl) {
    return (
      <div className={`${className} bg-gray-700 flex items-center justify-center`}>
        <span className="text-gray-500 text-xs">?</span>
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={alt || username}
      className={className}
    />
  );
};