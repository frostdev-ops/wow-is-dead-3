import { useEffect, useRef, memo } from 'react';
import { View } from 'skin3d';
import { logger, LogCategory } from '../utils/logger';

interface SkinViewerComponentProps {
  username: string;
  uuid: string;
  skinUrl?: string;
}

// Memoized SkinViewer component to prevent unnecessary Three.js re-renders
const SkinViewerComponentBase = ({ username, uuid, skinUrl }: SkinViewerComponentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<View | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    logger.debug(LogCategory.MINECRAFT, 'Initializing 3D viewer for:', { metadata: { username, uuid } });

    // Use the provided skin URL or fallback to crafatar
    const skin = skinUrl || `https://crafatar.com/skins/${uuid}`;
    logger.debug(LogCategory.MINECRAFT, 'Using skin URL:', { metadata: { url: skin } });

    try {
      // Create the skin viewer with smaller dimensions for head-only display
      const viewer = new View({
        width: 150,
        height: 150,
        skin: skin,
      });

      viewerRef.current = viewer;

      // Append the viewer's canvas to our container
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(viewer.canvas);

      logger.debug(LogCategory.MINECRAFT, 'Viewer created and appended');

      // Set up viewer options for full body display
      viewer.zoom = 0.9;
      viewer.fov = 50;

      // Position camera to see full player model
      viewer.camera.position.y = 0; // Center on full body
      viewer.camera.position.z = 40; // Distance to see full model

      logger.debug(LogCategory.MINECRAFT, 'Full player model configured for display');

      // Enable mouse tracking for rotation relative to the model
      let mouseX = 0;
      let mouseY = 0;
      let targetRotationY = 0;
      let targetRotationX = 0;

      const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;

        // Get mouse position relative to the model container
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate distance from center of model
        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;

        // Normalize to -1 to 1 range based on container size
        mouseX = deltaX / (rect.width / 2);
        mouseY = deltaY / (rect.height / 2);

        // Clamp values to reasonable range
        mouseX = Math.max(-1, Math.min(1, mouseX));
        mouseY = Math.max(-1, Math.min(1, mouseY));

        // Limit rotation to 35 degrees horizontally and 20 degrees vertically
        targetRotationY = mouseX * Math.PI * 0.2; // ~35 degrees max
        targetRotationX = mouseY * Math.PI * 0.12; // ~20 degrees max
      };

      window.addEventListener('mousemove', handleMouseMove);

      // Animation loop
      let animationId: number;
      let frameCount = 0;
      const animate = () => {
        if (viewer && viewer.playerObject && viewer.playerObject.skin) {
          const head = viewer.playerObject.skin.head;

          if (head) {
            // Rotate head to follow mouse (fast response)
            const currentHeadRotationY = head.rotation.y;
            const currentHeadRotationX = head.rotation.x;
            head.rotation.y += (targetRotationY - currentHeadRotationY) * 0.15;
            head.rotation.x += (targetRotationX - currentHeadRotationX) * 0.15;
          }
        }

        // Log every 180 frames (once per 3 seconds at 60fps) for debugging
        frameCount++;
        if (frameCount % 180 === 0) {
          logger.debug(LogCategory.MINECRAFT, 'Animation running', { metadata: { targetRotationY, targetRotationX } });
        }

        animationId = requestAnimationFrame(animate);
      };

      animate();
      console.log('[SkinViewer] Animation loop started');

      logger.debug(LogCategory.MINECRAFT, '3D viewer initialized successfully');

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (animationId) cancelAnimationFrame(animationId);
        if (viewerRef.current) {
          viewerRef.current.dispose?.();
        }
      };
    } catch (err) {
      if (err instanceof Error) {
        logger.error(LogCategory.MINECRAFT, 'Error initializing viewer', err);
      } else {
        logger.error(LogCategory.MINECRAFT, `Error initializing viewer: ${String(err)}`);
      }
    }
  }, [username, uuid]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '150px',
        height: '150px',
        pointerEvents: 'none',
      }}
    />
  );
};

// Export memoized component - only re-renders when props change
export const SkinViewerComponent = memo(SkinViewerComponentBase, (prevProps, nextProps) => {
  // Custom comparison function for optimal performance
  return (
    prevProps.username === nextProps.username &&
    prevProps.uuid === nextProps.uuid &&
    prevProps.skinUrl === nextProps.skinUrl
  );
});
