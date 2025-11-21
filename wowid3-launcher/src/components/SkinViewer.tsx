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
      // Create the skin viewer - original size 300x600
      const viewer = new View({
        width: 300,
        height: 600,
        skin: skin,
      });

      viewerRef.current = viewer;

      // Append the viewer's canvas to our container
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(viewer.canvas);

      logger.debug(LogCategory.MINECRAFT, 'Viewer created and appended');

      // Set up viewer options - original settings
      viewer.zoom = 1.0;
      viewer.fov = 50;

      // Adjust camera angle to view from higher up - original positioning
      viewer.camera.position.y = 20;
      viewer.camera.position.z = 45;

      logger.debug(LogCategory.MINECRAFT, '3D viewer configured with original size and positioning');

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

      // Wait for the model to load, then set sitting pose
      const setSittingPose = () => {
        if (!viewer.playerObject) {
          return;
        }

        // Find the skin object (contains the actual body parts)
        // Access children via type assertion since PlayerObject type doesn't include children
        const playerObj = viewer.playerObject as any;
        const skinObject = playerObj.children?.find((c: any) => c.name === 'skin');

        if (!skinObject) {
          return;
        }

        // Access body parts from skin object
        skinObject.children?.forEach((part: any) => {
          // Rotate legs for sitting (backward bend) and spread apart
          if (part.name === 'leftLeg') {
            part.rotation.x = -Math.PI / 2; // 90 degrees backward
            part.rotation.z = 0.2; // Spread outward
          }
          if (part.name === 'rightLeg') {
            part.rotation.x = -Math.PI / 2; // 90 degrees backward
            part.rotation.z = -0.2; // Spread outward
          }

          // Adjust arms to extend forward (like resting on knees)
          if (part.name === 'leftArm') {
            part.rotation.x = -0.8; // Extend forward
            part.rotation.z = 0.2; // Angle outward slightly
          }
          if (part.name === 'rightArm') {
            part.rotation.x = -0.8; // Extend forward
            part.rotation.z = -0.2; // Angle outward slightly
          }

          // Body rotation
          if (part.name === 'body') {
            part.rotation.x = -0.2; // Slight backward lean
          }
        });
      };

      // Try setting pose with delays to ensure model is loaded
      setTimeout(setSittingPose, 100);
      setTimeout(setSittingPose, 500);
      setTimeout(setSittingPose, 1000);

      // Animation loop
      let animationId: number;
      let frameCount = 0;
      const animate = () => {
        if (viewer && viewer.playerObject) {
          // Find the skin and head objects
          // Access children via type assertion since PlayerObject type doesn't include children
          const playerObj = viewer.playerObject as any;
          const skinObject = playerObj.children?.find((c: any) => c.name === 'skin');
          const head = skinObject?.children?.find((c: any) => c.name === 'head');

          if (head) {
            // Rotate head to follow mouse (fast response)
            const currentHeadRotationY = head.rotation.y;
            const currentHeadRotationX = head.rotation.x;
            head.rotation.y += (targetRotationY - currentHeadRotationY) * 0.15;
            head.rotation.x += (targetRotationX - currentHeadRotationX) * 0.15;

            // Rotate body to follow mouse (slower, delayed response)
            const currentBodyRotationY = viewer.playerObject.rotation.y;
            const bodyTargetRotationY = targetRotationY * 0.3; // Body rotates less
            viewer.playerObject.rotation.y += (bodyTargetRotationY - currentBodyRotationY) * 0.1;
          }
        }

        // Log every 60 frames (once per second at 60fps) for debugging
        frameCount++;
        if (frameCount % 60 === 0) {
          logger.debug(LogCategory.MINECRAFT, 'Animation running', { metadata: { targetRotationY, targetRotationX } });
        }

        animationId = requestAnimationFrame(animate);
      };

      animate();
      logger.debug(LogCategory.MINECRAFT, 'Animation loop started, 3D viewer initialized successfully');

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
        width: '300px',
        height: '600px',
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
