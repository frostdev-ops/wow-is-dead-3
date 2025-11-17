import { useEffect, useRef } from 'react';
import christmasTheme from '../../themes/christmas.json';

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
  drift: number;
}

export default function ChristmasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with device pixel ratio for crisp rendering on high-DPI
    const dpr = window.devicePixelRatio || 1;

    const updateCanvasSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Set canvas CSS size
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      // Set canvas drawing surface size with DPI consideration
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      // The scale needs to be reapplied after width/height change
      ctx.scale(dpr, dpr);

      console.log('[Canvas] Resized to', width, 'x', height, 'with DPR', dpr);
    };

    updateCanvasSize();

    // Debounce resize to avoid excessive updates
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateCanvasSize, 100);
    };

    window.addEventListener('resize', handleResize);

    // Create snowflakes (only for Christmas theme)
    const snowflakes: Snowflake[] = [];
    const shouldShowSnow = christmasTheme.animations.snowfall;
    const snowDensity = 60;
    const snowSpeed = 0.8;

    if (shouldShowSnow) {
      for (let i = 0; i < snowDensity; i++) {
        snowflakes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * (canvas.height + 100) - 100,
          radius: Math.random() * 4 + 2,
          speed: Math.random() * snowSpeed + 0.3,
          opacity: Math.random() * 0.6 + 0.4,
          drift: Math.random() * 1 - 0.5,
        });
      }
    }

    // Animation loop
    let animationFrameId: number;
    let lastTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const deltaTime = Math.min(currentTime - lastTime, 50) / 16.67; // Cap delta time
      lastTime = currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw snowflakes
      snowflakes.forEach((flake) => {
        // Update position with delta time for smooth animation
        flake.y += flake.speed * deltaTime;
        flake.x += flake.drift * deltaTime;

        // Draw the snowflake with a slight glow effect
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
        ctx.fill();

        // Add subtle glow
        ctx.strokeStyle = `rgba(255, 255, 255, ${flake.opacity * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Wrap around edges smoothly
        if (flake.y > canvas.height + 10) {
          flake.y = -10;
          flake.x = Math.random() * canvas.width;
        }

        if (flake.x > canvas.width + 10) {
          flake.x = -10;
        } else if (flake.x < -10) {
          flake.x = canvas.width + 10;
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* Background gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-christmas-darkBg via-red-950 to-christmas-darkBg"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(196, 30, 58, 0.1) 0%, transparent 50%)`,
        }}
      />

      {/* Snow canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
      />

      {/* Twinkling lights overlay */}
      <div className="absolute top-0 left-0 right-0 h-16 flex justify-around items-start p-4 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-twinkle"
            style={{
              backgroundColor: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#C41E3A' : '#0F8A5F',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}
