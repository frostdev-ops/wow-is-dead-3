import { useMemo } from 'react';

interface Snowflake {
  id: number;
  left: string;
  animationDuration: string;
  animationDelay: string;
  size: number;
  opacity: number;
}

export default function ChristmasBackground() {
  // Generate snowflakes
  const snowflakes = useMemo(() => {
    const flakes: Snowflake[] = [];
    for (let i = 0; i < 200; i++) {
      flakes.push({
        id: i,
        left: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 10 + 8}s`, // 8-18 seconds (much slower)
        animationDelay: `${Math.random() * 15}s`,
        size: Math.random() * 6 + 4, // 4-10px (bigger)
        opacity: Math.random() * 0.6 + 0.4, // 0.4-1.0
      });
    }
    console.log('[Snow] Created', flakes.length, 'snowflakes using DOM elements');
    return flakes;
  }, []);

  return (
    <>
      {/* Background gradient - Day layer */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, #5e8ce2ff 0%, #759bd8ff 50%, #3c236bff 100%)`,
          zIndex: 1,
        }}
      />

      {/* Background gradient - Night layer with opacity animation */}
      <div
        className="absolute inset-0 animate-night-fade"
        style={{
          backgroundImage: `linear-gradient(to bottom, #0f1f38 0%, #1a2847 50%, #0a0e27 100%)`,
          zIndex: 2,
        }}
      />

      {/* Snow - DOM elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="absolute animate-snowfall"
            style={{
              left: flake.left,
              top: '-10px',
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              backgroundColor: 'white',
              borderRadius: '50%',
              opacity: flake.opacity,
              boxShadow: `0 0 ${flake.size * 2}px rgba(255, 255, 255, 0.8)`,
              animationDuration: flake.animationDuration,
              animationDelay: flake.animationDelay,
            }}
          />
        ))}
      </div>

      {/* Twinkling lights overlay */}
      <div className="absolute top-12 left-0 right-0 h-16 flex justify-around items-start p-4 pointer-events-none" style={{ zIndex: 3 }}>
        {Array.from({ length: 20 }).map((_, i) => {
          // Pattern: Red, Green, Yellow, Red, Green, Yellow...
          const colorIndex = i % 3;
          const colors = ['#DC143C', '#228B22', '#FFD700']; // Red, Green, Yellow
          const color = colors[colorIndex];

          // Use negative delays to offset where each light starts in the animation cycle
          // Animation cycles: Red (0-33%) → Green (34-66%) → Yellow (67-100%)
          // All lights animate at same time, but start at different points:
          // Red lights: 0s delay (starts at Red)
          // Green lights: -1s delay (starts at Green, which is 33% through 3s cycle)
          // Yellow lights: -2s delay (starts at Yellow, which is 67% through 3s cycle)
          const animationDelay = -colorIndex * 1; // 0s, -1s, -2s

          return (
            <div
              key={i}
              className="w-4 h-4 rounded-full animate-christmas-lights"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
                animationDelay: `${animationDelay}s`,
              }}
            />
          );
        })}
      </div>
    </>
  );
}
