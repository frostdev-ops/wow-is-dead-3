import { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import api from '@/api/client';

const SPLASH_TEXTS = [
  "sometimes people don't notice when you piss in the pool",
  "did trump fuck bill clinton?",
  "i did not hit her!111!1!!!!!!111!",
  "Shadow Company top bruh moments #9",
  "bing bong",
  "every miku is canon",
  "bad apple music video",
  "geeli beeli guumi peet rat candi",
  "i went crazy once, they put me in a rubber room, a rubber room filled with rats, the rats made me crazy. i went crazy once, they put me in a rubber room, a rubber room filled with rats, the rats made me crazy. i went crazy once, they put me in a rubber room, a rubber room filled with rats, the rats made me crazy. i went crazy once, they put me in a rubber room, a rubber room filled with rats, the rats made me crazy.",
  "sorry for having great tits and correct opinions",
  "loothing says no more porn",
  "rith crithpieths threaths",
  "reeces peepees",
  "illidans dick being 20in is canon",
  "lebron 67"
];

interface LauncherManifest {
  version: string;
  url: string;
  size: number;
  changelog: string;
}

interface Snowflake {
  id: number;
  left: string;
  animationDuration: string;
  animationDelay: string;
  size: number;
  opacity: number;
}

interface TrailSnowflake {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  createdAt: number;
}

export default function DownloadPage() {
  const [manifest, setManifest] = useState<LauncherManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [splashText, setSplashText] = useState("");
  const [trailSnowflakes, setTrailSnowflakes] = useState<TrailSnowflake[]>([]);
  
  // Audio refs
  const hoverSound = useRef<HTMLAudioElement | null>(null);
  const clickSound = useRef<HTMLAudioElement | null>(null);
  
  const trailIdRef = useRef(0);
  const lastTrailTimeRef = useRef(0);

  useEffect(() => {
    // Initialize random splash text
    setSplashText(SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)]);

    // Initialize audio
    hoverSound.current = new Audio('/misc/hover.ogg');
    clickSound.current = new Audio('/misc/clicksound.ogg');
    hoverSound.current.volume = 0.5;
    clickSound.current.volume = 0.5;

    // Fetch manifest
    api.get('/launcher/latest')
      .then(res => setManifest(res.data))
      .catch(err => console.error('Failed to fetch launcher manifest:', err))
      .finally(() => setIsLoading(false));
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

  const playHover = () => {
    if (hoverSound.current) {
      hoverSound.current.currentTime = 0;
      hoverSound.current.play().catch(() => {});
    }
  };

  const playClick = () => {
    if (clickSound.current) {
      clickSound.current.currentTime = 0;
      clickSound.current.play().catch(() => {});
    }
  };

  // Generate snowflakes (Updated to match launcher: 200 flakes, slower, larger)
  const snowflakes = useMemo(() => {
    const flakes: Snowflake[] = [];
    for (let i = 0; i < 200; i++) {
      flakes.push({
        id: i,
        left: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 10 + 8}s`, // 8-18 seconds (slower)
        animationDelay: `${Math.random() * 15}s`,
        size: Math.random() * 6 + 4, // 4-10px (bigger)
        opacity: Math.random() * 0.6 + 0.4, // 0.4-1.0
      });
    }
    return flakes;
  }, []);

  const downloadUrl = manifest ? `/files/launcher/WOWID3Launcher.exe` : '#';

  return (
    <div 
      className="min-h-screen flex flex-col relative overflow-hidden font-sans text-white selection:bg-yellow-400 selection:text-black"
      style={{
        backgroundImage: "url('/background/bgloadscreen.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        cursor: "url('/misc/cursor.png'), auto"
      }}
    >
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

      {/* Side Decorations */}
      <img 
        src="/misc/cabinleft.png" 
        className="absolute left-0 top-0 h-full w-auto object-cover z-0 hidden xl:block pointer-events-none"
        alt=""
      />
      <img 
        src="/misc/cabinright.png" 
        className="absolute right-0 top-0 h-full w-auto object-cover z-0 hidden xl:block pointer-events-none"
        alt=""
      />

      {/* Top Navigation / Status */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4 bg-[#003366]/80 backdrop-blur-md px-4 py-2 rounded-2xl border-4 border-white shadow-xl transform -rotate-1 hover:rotate-0 transition-transform duration-300">
          <img src="/wid3icon.png" alt="Icon" className="w-10 h-10 drop-shadow-lg" />
          <span className="font-black text-xl tracking-wider text-yellow-400 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]" style={{ fontFamily: "'Trebuchet MS', sans-serif", textShadow: '2px 2px 0 #000' }}>
            WOW IS DEAD 3
          </span>
        </div>
        
        <div className="flex items-center gap-2">
           <a 
             href="/login" 
             className="text-sm font-bold bg-[#003366] hover:bg-[#004488] px-4 py-2 rounded-full border-2 border-white transition-all hover:scale-105 active:scale-95 shadow-[0_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1"
             onMouseEnter={playHover}
             onClick={playClick}
           >
             Admin Panel
           </a>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-4 text-center mt-[-40px]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
          className="max-w-5xl mx-auto flex flex-col items-center"
        >
          {/* Logo */}
          <div className="relative mb-6 hover:scale-105 transition-transform duration-500 ease-in-out">
            <img 
              src="/logo.png" 
              alt="WOW IS DEAD 3 Logo" 
              className="h-32 md:h-56 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
            />
            <motion.div 
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              className="absolute -top-6 -right-6 md:-right-12 bg-yellow-400 text-black font-black text-sm md:text-lg px-3 py-1 rounded-full border-4 border-white shadow-lg transform rotate-12"
            >
              v3.0
            </motion.div>
          </div>
          
          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-black text-white drop-shadow-[0_5px_0_rgba(0,0,0,0.5)] stroke-black mb-4 tracking-tight" style={{ textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
            WOW IS DEAD 3: <br className="md:hidden" />
            <span className="text-yellow-400">OFFICIALLY DEAD, FOR THE THIRD TIME!</span>
          </h1>
          
          {/* Splash Text */}
          <div className="mb-12 relative max-w-2xl">
            <div className="absolute -inset-2 bg-black/40 blur-lg rounded-[2rem]"></div>
            <p className="relative text-xl md:text-2xl font-bold text-yellow-300 font-comic italic transform -rotate-1 leading-relaxed px-6 py-2 drop-shadow-md" style={{ fontFamily: "'Comic Sans MS', 'Chalkboard SE', sans-serif" }}>
              "{splashText}"
            </p>
          </div>

          {/* Custom Download Button */}
          <div className="relative z-20 mb-16">
            <a
              href={downloadUrl}
              className={`group block relative w-96 h-40 md:w-[32rem] md:h-48 transition-transform duration-100 active:scale-95 ${!manifest && !isLoading ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
              onMouseEnter={playHover}
              onClick={(e) => {
                if (!manifest && !isLoading) {
                  e.preventDefault();
                } else {
                  playClick();
                }
              }}
            >
              {/* Images - Absolute positioning for instant swap */}
              <img 
                src="/buttons/cookiebuttonbig.png" 
                alt="Download Button" 
                className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl transition-opacity duration-0 group-hover:opacity-0"
              />
              <img 
                src="/buttons/cookiebuttonbighover.png" 
                alt="Download Button Hover" 
                className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl opacity-0 transition-opacity duration-0 group-hover:opacity-100"
              />
              
              {/* Text Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-4 pointer-events-none">
                <span className="text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)]" style={{ textShadow: '3px 3px 0 #000' }}>
                  {isLoading ? "LOADING..." : "DOWNLOAD"}
                </span>
              </div>

              {/* Version Badge */}
              {manifest && (
                 <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-md border-2 border-white/20 rounded-full px-6 py-1.5 shadow-xl whitespace-nowrap pointer-events-none transition-transform group-hover:scale-105">
                   <span className="text-sm font-bold text-yellow-200 drop-shadow-md tracking-wide">
                     v{manifest.version} • Windows
                   </span>
                 </div>
              )}
            </a>
          </div>

          {/* Features Grid - Club Penguin Style Modals */}
          <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl px-4">
            <FeatureModal 
              imgSrc="/buttons/spbutton.png"
              title="Auto-Updates"
              description="Keeps your game fresh so you don't have to touch grass."
            />
            <FeatureModal 
              imgSrc="/buttons/optionbutton.png"
              title="Verified Integrity"
              description="We check the files so you don't get rat-ed (unless its part of the lore)."
            />
            <FeatureModal 
              imgSrc="/buttons/mpbutton.png"
              title="Server Synced"
              description="Connects directly to the hivemind. Resistance is futile."
            />
          </div>

        </motion.div>
      </main>

      {/* Footer Image */}
      <div className="relative z-10 w-full flex justify-center mt-auto pointer-events-none">
         <img src="/misc/loadscreenfooter.png" alt="" className="max-w-full h-auto opacity-90" />
      </div>
      
      {/* Copyright */}
      <footer className="relative z-20 py-4 text-center text-xs font-bold text-white/60 bg-[#003366]/90 backdrop-blur-md border-t-4 border-white/20">
        <p>© 2025 WOWID3. Not affiliated with Mojang, Microsoft, or Club Penguin (RIP).</p>
      </footer>
    </div>
  );
}

function FeatureModal({ imgSrc, title, description }: { imgSrc: string, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.05, rotate: 1 }}
      className="bg-[#003366] border-[6px] border-white rounded-3xl p-6 text-left shadow-[0_10px_20px_rgba(0,0,0,0.5)] relative overflow-hidden group"
    >
      {/* Shine effect */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
      
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-xl">
          <img src={imgSrc} alt={title} className="w-20 h-20 object-contain" />
        </div>
        <h3 className="text-2xl font-black text-white mb-2 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]" style={{ fontFamily: "'Trebuchet MS', sans-serif", textShadow: '2px 2px 0 #000' }}>
          {title}
        </h3>
        <p className="text-white/90 font-bold text-sm leading-relaxed drop-shadow-md">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
