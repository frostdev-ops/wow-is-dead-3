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
    let imageLoadTimeout: NodeJS.Timeout;

    const fetchAvatar = async () => {
      console.log('[SecureAvatar] 1️⃣ Starting avatar fetch for:', username);

      try {
        setLoading(true);
        setImgError(false);

        // Use Tauri backend to fetch avatar (bypasses CSP issues in production)
        console.log('[SecureAvatar] 2️⃣ Invoking cmd_fetch_avatar...');
        const data = await invoke<AvatarData>('cmd_fetch_avatar', {
          username: username
        });

        console.log('[SecureAvatar] 3️⃣ Avatar data received:', {
          content_type: data.content_type,
          data_length: data.data?.length || 0,
          data_preview: data.data?.substring(0, 50) + '...'
        });

        if (!mounted) {
          console.log('[SecureAvatar] ❌ Component unmounted, aborting');
          return;
        }

        // Convert base64 data to data URI
        const fullSkinDataUri = `data:${data.content_type};base64,${data.data}`;
        console.log('[SecureAvatar] 4️⃣ Created data URI, length:', fullSkinDataUri.length);

        // Load the full skin image
        const img = new Image();
        console.log('[SecureAvatar] 5️⃣ Created Image element');

        // Set timeout for image loading (5 seconds max)
        imageLoadTimeout = setTimeout(() => {
          if (mounted) {
            console.error('[SecureAvatar] ⏱️ TIMEOUT: Image load timeout after 5s for:', username);
            setImgError(true);
            setLoading(false);
            onError?.();
          }
        }, 5000);

        img.onload = () => {
          console.log('[SecureAvatar] 6️⃣ Image onload fired!', {
            width: img.width,
            height: img.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          });

          clearTimeout(imageLoadTimeout);
          if (!mounted) {
            console.log('[SecureAvatar] ❌ Component unmounted in onload');
            return;
          }

          try {
            // Create canvas to extract just the head (face) portion
            // Minecraft skin: 64x64 texture, face is top-left 8x8 pixels
            console.log('[SecureAvatar] 7️⃣ Creating canvas...');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: false });

            if (!ctx) {
              console.error('[SecureAvatar] ❌ FAILED: Could not get canvas context');
              setImgError(true);
              setLoading(false);
              return;
            }

            console.log('[SecureAvatar] 8️⃣ Got canvas context, setting up...');

            // Set canvas size to just the face (8x8), but scale up for better quality
            const scale = 8; // Scale up 8x for crisp rendering
            canvas.width = 8 * scale;
            canvas.height = 8 * scale;

            // Disable image smoothing for pixel-perfect rendering
            ctx.imageSmoothingEnabled = false;

            console.log('[SecureAvatar] 9️⃣ Drawing to canvas...');
            // Extract the face (top-left 8x8 pixels from the 64x64 skin)
            // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
            ctx.drawImage(
              img,
              8, 8,    // Source x, y (face starts at 8,8 in skin texture)
              8, 8,    // Source width, height (8x8 face)
              0, 0,    // Destination x, y
              8 * scale, 8 * scale  // Destination width, height (scaled up)
            );
            // Extract overlay/hat layer (8x8 at position 40,8) and draw on top
            ctx.drawImage(
              img,
              40, 8,   // Source x, y (overlay starts at 40,8 in skin texture)
              8, 8,    // Source width, height (8x8 overlay)
              0, 0,    // Destination x, y
              8 * scale, 8 * scale  // Destination width, height (scaled up)
            );

            console.log('[SecureAvatar] 🔟 Converting canvas to data URL...');
            // Convert canvas to data URL
            const headDataUri = canvas.toDataURL('image/png');
            console.log('[SecureAvatar] ✅ SUCCESS: Head data URI created, length:', headDataUri.length);

            setAvatarUrl(headDataUri);
            setLoading(false);
            console.log('[SecureAvatar] ✅ Avatar URL set successfully for:', username);
          } catch (canvasError) {
            console.error('[SecureAvatar] ❌ CANVAS ERROR:', canvasError);
            console.error('[SecureAvatar] Canvas error stack:', (canvasError as Error).stack);
            setImgError(true);
            setLoading(false);
          }
        };

        img.onerror = (e) => {
          clearTimeout(imageLoadTimeout);
          console.error('[SecureAvatar] ❌ IMAGE ERROR:', {
            event: e,
            username,
            dataUriLength: fullSkinDataUri.length,
            dataUriPrefix: fullSkinDataUri.substring(0, 100)
          });
          if (mounted) {
            setImgError(true);
            setLoading(false);
            onError?.();
          }
        };

        console.log('[SecureAvatar] 🖼️ Setting img.src to data URI...');
        img.src = fullSkinDataUri;

        // Check if image is already complete (cached)
        if (img.complete) {
          console.log('[SecureAvatar] ⚡ Image already complete (cached), dispatching load event');
          img.dispatchEvent(new Event('load'));
        }

        // Try decode if available
        if (img.decode) {
          console.log('[SecureAvatar] 🔄 Calling img.decode()...');
          img.decode()
            .then(() => {
              console.log('[SecureAvatar] ✅ img.decode() succeeded');
            })
            .catch((err) => {
              console.error('[SecureAvatar] ❌ img.decode() failed:', err);
              if (mounted) {
                setImgError(true);
                setLoading(false);
                onError?.();
              }
            });
        } else {
          console.log('[SecureAvatar] ⚠️ img.decode() not available in this browser');
        }

      } catch (error) {
        console.error('[SecureAvatar] ❌ FETCH ERROR:', error);
        console.error('[SecureAvatar] Error details:', {
          message: (error as Error).message,
          stack: (error as Error).stack,
          error: error
        });
        if (mounted) {
          setImgError(true);
          setLoading(false);
          onError?.();
        }
      }
    };

    fetchAvatar();

    return () => {
      console.log('[SecureAvatar] 🧹 Cleanup for:', username);
      mounted = false;
      if (imageLoadTimeout) clearTimeout(imageLoadTimeout);
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