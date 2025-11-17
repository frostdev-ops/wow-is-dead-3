import { useEffect, useRef } from 'react';
import { View } from 'skin3d';

interface SkinViewerComponentProps {
  username: string;
  uuid: string;
  skinUrl?: string;
}

export const SkinViewerComponent = ({ username, uuid, skinUrl }: SkinViewerComponentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    console.log('[SkinViewer] Initializing 3D viewer for:', username, uuid);

    // Use the provided skin URL or fallback to crafatar
    const skin = skinUrl || `https://crafatar.com/skins/${uuid}`;
    console.log('[SkinViewer] Using skin URL:', skin);

    try {
      // Create the skin viewer without passing canvas - it creates its own
      const viewer = new View({
        width: 300,
        height: 600,
        skin: skin,
      });

      viewerRef.current = viewer;

      // Append the viewer's canvas to our container
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(viewer.canvas);

      console.log('[SkinViewer] Viewer created and appended:', viewer);

      // Set up viewer options
      viewer.zoom = 1.0;
      viewer.fov = 50;

      // Adjust camera angle to view from higher up
      viewer.camera.position.y = 20;
      viewer.camera.position.z = 45;

      // Wait for the model to load, then set sitting pose
      const setSittingPose = () => {
        console.log('[SkinViewer] Attempting to set sitting pose...');
        console.log('[SkinViewer] viewer.playerObject:', viewer.playerObject);

        if (!viewer.playerObject) {
          console.log('[SkinViewer] No playerObject yet, skipping...');
          return;
        }

        // Find the skin object (contains the actual body parts)
        const skinObject = viewer.playerObject.children?.find((c: any) => c.name === 'skin');
        console.log('[SkinViewer] Found skinObject:', skinObject);

        if (!skinObject) {
          console.log('[SkinViewer] No skinObject found, skipping...');
          return;
        }

        console.log('[SkinViewer] Setting sitting pose...');
        console.log('[SkinViewer] Skin children:', skinObject.children);

        // Access body parts from skin object
        skinObject.children?.forEach((part: any) => {
          console.log('[SkinViewer] Body part:', part.name, part);

          // Rotate legs for sitting (backward bend) and spread apart
          if (part.name === 'leftLeg') {
            part.rotation.x = -Math.PI / 2; // 90 degrees backward
            part.rotation.z = 0.2; // Spread outward
            console.log(`[SkinViewer] Rotated ${part.name} to sitting position`);
          }
          if (part.name === 'rightLeg') {
            part.rotation.x = -Math.PI / 2; // 90 degrees backward
            part.rotation.z = -0.2; // Spread outward
            console.log(`[SkinViewer] Rotated ${part.name} to sitting position`);
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
        })
      };

      // Try setting pose with delays to ensure model is loaded
      setTimeout(setSittingPose, 100);
      setTimeout(setSittingPose, 500);
      setTimeout(setSittingPose, 1000);

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
        if (viewer && viewer.playerObject) {
          // Find the skin and head objects
          const skinObject = viewer.playerObject.children?.find((c: any) => c.name === 'skin');
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
          console.log('[SkinViewer] Animation running, targetRotationY:', targetRotationY, 'targetRotationX:', targetRotationX);
        }

        animationId = requestAnimationFrame(animate);
      };

      animate();
      console.log('[SkinViewer] Animation loop started');

      console.log('[SkinViewer] 3D viewer initialized successfully');

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (animationId) cancelAnimationFrame(animationId);
        if (viewerRef.current) {
          viewerRef.current.dispose?.();
        }
      };
    } catch (err) {
      console.error('[SkinViewer] Error initializing viewer:', err);
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
