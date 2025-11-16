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

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create snowflakes
    const snowflakes: Snowflake[] = [];
    const { snowDensity, snowSpeed } = christmasTheme.animations;

    for (let i = 0; i < snowDensity; i++) {
      snowflakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 3 + 1,
        speed: Math.random() * snowSpeed + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        drift: Math.random() * 0.5 - 0.25,
      });
    }

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw snowflakes
      snowflakes.forEach((flake) => {
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
        ctx.fill();

        // Update position
        flake.y += flake.speed;
        flake.x += flake.drift;

        // Reset if off screen
        if (flake.y > canvas.height) {
          flake.y = -10;
          flake.x = Math.random() * canvas.width;
        }

        if (flake.x > canvas.width) {
          flake.x = 0;
        } else if (flake.x < 0) {
          flake.x = canvas.width;
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
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
