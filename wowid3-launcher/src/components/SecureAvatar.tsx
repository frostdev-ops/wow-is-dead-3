import { FC, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SecureAvatarProps {
  username: string;
  className?: string;
  alt?: string;
  onError?: () => void;
}

interface AvatarData {
  data: string; // Base64 encoded image data
  content_type: string;
}

/**
 * Displays a 2D head avatar for the player
 * Uses Tauri backend to proxy avatar requests (works in production builds with CSP)
 * Extracts just the face portion (8x8 pixels) from the full Minecraft skin
 */
export const SecureAvatar: FC<SecureAvatarProps> = ({ username, className = '', alt = '', onError }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchAvatar = async () => {
      try {
        setLoading(true);
        setImgError(false);

        // Use Tauri backend to fetch avatar (bypasses CSP issues in production)
        const data = await invoke<AvatarData>('cmd_fetch_avatar', {
          username: username
        });

        if (!mounted) return;

        // Convert base64 data to data URI
        const fullSkinDataUri = `data:${data.content_type};base64,${data.data}`;

        // Load the full skin image
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          if (!mounted) return;

          // Create canvas to extract just the head (face) portion
          // Minecraft skin: 64x64 texture, face is top-left 8x8 pixels
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            setImgError(true);
            setLoading(false);
            return;
          }

          // Set canvas size to just the face (8x8), but scale up for better quality
          const scale = 8; // Scale up 8x for crisp rendering
          canvas.width = 8 * scale;
          canvas.height = 8 * scale;

          // Disable image smoothing for pixel-perfect rendering
          ctx.imageSmoothingEnabled = false;

          // Extract the face (top-left 8x8 pixels from the 64x64 skin)
          // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
          ctx.drawImage(
            img,
            8, 8,    // Source x, y (face starts at 8,8 in skin texture)
            8, 8,    // Source width, height (8x8 face)
            0, 0,    // Destination x, y
            8 * scale, 8 * scale  // Destination width, height (scaled up)
          );

          // Convert canvas to data URL
          const headDataUri = canvas.toDataURL('image/png');
          setAvatarUrl(headDataUri);
          setLoading(false);
        };

        img.onerror = () => {
          if (mounted) {
            setImgError(true);
            setLoading(false);
            onError?.();
          }
        };

        img.src = fullSkinDataUri;

      } catch (error) {
        console.error('[SecureAvatar] Failed to fetch avatar:', error);
        if (mounted) {
          setImgError(true);
          setLoading(false);
          onError?.();
        }
      }
    };

    fetchAvatar();

    return () => {
      mounted = false;
    };
  }, [username, onError]);

  const handleError = () => {
    setImgError(true);
    onError?.();
  };

  if (loading || imgError || !avatarUrl) {
    return (
      <div className={`${className} bg-gradient-to-br from-red-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold rounded overflow-hidden`}>
        {username[0]?.toUpperCase() || '?'}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={alt || username}
      className={className}
      onError={handleError}
      style={{ imageRendering: 'pixelated' }} // Keep pixels crisp
    />
  );
};