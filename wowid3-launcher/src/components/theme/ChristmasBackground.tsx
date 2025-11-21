import { useMemo, useState, useEffect, useRef } from 'react';
import { logger, LogCategory } from '../../utils/logger';

interface Snowflake {
  id: number;
  left: string;
  animationDuration: string;
  animationDelay: string;
  size: number;
  opacity: number;
}

interface Cookie {
  id: number;
  left: string;
  animationDuration: string;
}

interface TrailSnowflake {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  createdAt: number;
}

export default function ChristmasBackground() {
  const [cookies, setCookies] = useState<Cookie[]>([]);
  const [cookieClickCount, setCookieClickCount] = useState(0);
  const [trailSnowflakes, setTrailSnowflakes] = useState<TrailSnowflake[]>([]);
  const cookieIdRef = useRef(0);
  const trailIdRef = useRef(0);
  const lastTrailTimeRef = useRef(0);

  // Handle cookie click
  const handleCookieClick = (cookieId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    // Pool audio object instead of creating new one each time
    // Use a shorter-lived reference to prevent memory buildup
    try {
    const audio = new Audio('/pop.mp3');
    audio.volume = 0.3; // Set volume to 30%

    // Clean up audio object when playback ends or fails
    const cleanup = () => {
        audio.pause();
        audio.currentTime = 0;
      audio.removeEventListener('ended', cleanup);
      audio.removeEventListener('error', cleanup);
        // Dereference to allow garbage collection
        (audio as any).src = '';
    };

      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });

      // Auto-cleanup after 2 seconds (longer than typical pop sound ~1s)
      const timeout = setTimeout(cleanup, 2000);

    audio.play().catch(err => {
        clearTimeout(timeout);
      logger.debug(LogCategory.UI, `Audio play failed: ${err}`);
      cleanup();
    });
    } catch (err) {
      logger.debug(LogCategory.UI, `Failed to create audio: ${err}`);
    }

    setCookieClickCount(prev => prev + 1);
    // Remove the clicked cookie immediately
    setCookies(prev => prev.filter(c => c.id !== cookieId));
  };

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

  // Mouse trail snowflakes
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      // Spawn trail snowflake every 20ms to avoid too many particles
      if (now - lastTrailTimeRef.current < 20) return;
      lastTrailTimeRef.current = now;

      // Create 1-2 snowflakes at mouse position with slight randomness
      const trailCount = Math.random() > 0.5 ? 2 : 1;
      const newTrailFlakes: TrailSnowflake[] = [];

      for (let i = 0; i < trailCount; i++) {
        newTrailFlakes.push({
          id: trailIdRef.current++,
          x: e.clientX + (Math.random() - 0.5) * 30,
          y: e.clientY + (Math.random() - 0.5) * 30,
          size: Math.random() * 4 + 3, // 3-7px
          opacity: Math.random() * 0.6 + 0.4, // 0.4-1.0
          createdAt: now,
        });
      }

      setTrailSnowflakes(prev => [...prev, ...newTrailFlakes]);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Clean up old trail snowflakes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTrailSnowflakes(prev =>
        prev.filter(flake => now - flake.createdAt < 1000) // Remove after 1 second
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Generate falling cookies at random intervals - spawn rate increases with clicks
  useEffect(() => {
    const spawnCookie = () => {
      // Spawn on left or right side, avoiding center where play button is
      const spawnOnLeft = Math.random() < 0.5;
      const leftPosition = spawnOnLeft
        ? Math.random() * 40 // 0-40% (left side)
        : 60 + Math.random() * 40; // 60-100% (right side)

      const newCookie: Cookie = {
        id: cookieIdRef.current++,
        left: `${leftPosition}%`,
        animationDuration: `${Math.random() * 3 + 4}s`, // 4-7 seconds
      };

      setCookies(prev => [...prev, newCookie]);

      // Remove cookie after animation completes
      setTimeout(() => {
        setCookies(prev => prev.filter(c => c.id !== newCookie.id));
      }, 7000);
    };

    let timeoutId: number | null = null;

    // Spawn delay decreases as cookie count increases
    const scheduleNext = () => {
      const baseMinDelay = 30000; // 30 seconds base minimum
      const baseMaxDelay = 50000; // 50 seconds base maximum (ensures ~2.4 cookies per 2 minutes minimum)
      const reductionPerClick = 1000; // Each click reduces delay by 1 second

      // Minimum delay gets faster as you click, bottoming out at 1-2 seconds
      const minDelay = Math.max(1000, baseMinDelay - (cookieClickCount * reductionPerClick));
      const maxDelay = Math.max(2000, baseMaxDelay - (cookieClickCount * reductionPerClick));

      const delay = Math.random() * (maxDelay - minDelay) + minDelay;

      timeoutId = setTimeout(() => {
        spawnCookie();
        scheduleNext();
      }, delay) as any;
    };

    scheduleNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [cookieClickCount]);

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

      {/* Mouse trail snowflakes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10000 }}>
        {trailSnowflakes.map((flake) => {
          const age = Date.now() - flake.createdAt;
          const progress = age / 1000; // 0 to 1 over 1 second
          const fadeOpacity = Math.max(0, 1 - progress); // Fade from 1 to 0
          const finalOpacity = flake.opacity * fadeOpacity;

          return (
            <div
              key={flake.id}
              style={{
                position: 'fixed',
                left: `${flake.x}px`,
                top: `${flake.y}px`,
                width: `${flake.size}px`,
                height: `${flake.size}px`,
                backgroundColor: 'white',
                borderRadius: '50%',
                opacity: finalOpacity,
                boxShadow: `0 0 ${flake.size * 2}px rgba(255, 255, 255, ${0.8 * fadeOpacity})`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            />
          );
        })}
      </div>

      {/* Falling Minecraft Cookies */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 9998 }}>
        {cookies.map((cookie) => (
          <div
            key={cookie.id}
            className="absolute animate-snowfall cursor-pointer pointer-events-auto"
            onClick={(e) => handleCookieClick(cookie.id, e)}
            style={{
              left: cookie.left,
              top: '-40px',
              animationDuration: cookie.animationDuration,
            }}
          >
            {/* Clickable area - larger than the cookie */}
            <div style={{
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '-16px'  // Center the larger click area around the cookie
            }}>
              {/* Minecraft cookie from public folder */}
              <img
                src="/cookie.png"
                alt="Minecraft cookie"
                width="48"
                height="48"
                style={{ imageRendering: 'pixelated', pointerEvents: 'none', userSelect: 'none' }}
                draggable={false}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Cookie Click Counter */}
      {cookieClickCount > 0 && (
        <div
          className="absolute top-12 right-8"
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '0',
            height: '72px',
            padding: '0 1rem',
          }}
        >
          <div className="flex items-center gap-2 h-full">
            <img
              src="/cookie.png"
              alt="Cookie"
              width="24"
              height="24"
              style={{ imageRendering: 'pixelated' }}
            />
            <span
              className="text-white font-bold text-lg"
              style={{ fontFamily: "'Trebuchet MS', sans-serif" }}
            >
              {cookieClickCount}
            </span>
          </div>
        </div>
      )}

      {/* Twinkling lights overlay */}
      <div className="absolute top-12 left-0 right-0 h-16 pointer-events-none" style={{ zIndex: 3 }}>
        {/* Rope/Wire - SVG curved line */}
        <svg className="absolute w-full h-full" style={{ top: '16px' }} preserveAspectRatio="none" viewBox="0 0 2000 100">
          <path
            d="M -100,20 Q 50,35 100,20 T 200,20 T 300,20 T 400,20 T 500,20 T 600,20 T 700,20 T 800,20 T 900,20 T 1000,20 T 1100,20 T 1200,20 T 1300,20 T 1400,20 T 1500,20 T 1600,20 T 1700,20 T 1800,20 T 1900,20 T 2000,20 T 2100,20"
            stroke="#2d2d2d"
            strokeWidth="3"
            fill="none"
            opacity="0.8"
            vectorEffect="non-scaling-stroke"
          />
          {/* Wire highlight for 3D effect */}
          <path
            d="M -100,19 Q 50,34 100,19 T 200,19 T 300,19 T 400,19 T 500,19 T 600,19 T 700,19 T 800,19 T 900,19 T 1000,19 T 1100,19 T 1200,19 T 1300,19 T 1400,19 T 1500,19 T 1600,19 T 1700,19 T 1800,19 T 1900,19 T 2000,19 T 2100,19"
            stroke="#4a4a4a"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="flex justify-around items-start p-4">
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

            // Adjust Y position to follow the rope's wave pattern
            // Shorter pattern that repeats more frequently
            const wavePattern = [0, 12, 0]; // up, down, up
            const yOffset = wavePattern[i % wavePattern.length];

            return (
              <div key={i} className="relative" style={{ marginTop: `${yOffset}px` }}>
                {/* Wire attachment */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-gradient-to-b from-gray-700 to-gray-800"
                  style={{ zIndex: -1 }}
                />
                {/* Light bulb */}
                <div
                  className="w-4 h-4 rounded-full animate-christmas-lights"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
                    animationDelay: `${animationDelay}s`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
