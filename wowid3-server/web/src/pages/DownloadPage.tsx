import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
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
  "lebron 67",
  "legalize nuclear bombs",
  "shadow wizard money gang",
  "we love casting spells",
  "man door hand hook car door",
  "google en passant",
  "holy hell",
  "chat is this real?",
  "mom get the camera",
  "connection terminated",
  "the missile knows where it is",
  "i am living in your walls",
  "nice argument senator",
  "my source is that i made it the fuck up",
  "nanomachines son",
  "kid named finger",
  "shrek 2 free download 240p",
  "sata andagi",
  "osaka moment",
  "subway surfers gameplay playing below",
  "family guy funny moments #420",
  "skyler where is the money",
  "jesse we need to cook",
  "rat.exe running...",
  "horizontally spinning rat",
  "free vbucks generator no scam",
  "loss.jpg",
  "gregtech new horizons",
  "what da dog doin",
  "certified hood classic",
  "metal pipe falling sound effect",
  "who is deez?",
  "among us potion at 3am",
  "war crime this, code of conduct that",
  "road work ahead? uh yeah i sure hope it does",
  "chris is that a weed",
  "look at all those chickens",
  "i smell like beef",
  "fre shavaca do",
  "whoever threw that paper, your moms a hoe",
  "stop i coulda dropped my croissant",
  "two bros chillin in a hot tub",
  "what are those",
  "back at it again at krispy kreme",
  "i don't have enough money for chicken nuggets",
  "why you always lyin",
  "hi my name is trey i have a basketball game tomorrow",
  "merry chrysler",
  "happy crism",
  "an avocado... thaaanks",
  "hurricane katrina more like hurricane tortilla",
  "Type Shit"
];

const WEDNESDAY_SPLASH = "it is wednesday my dudes";

interface LauncherManifest {
  version: string;
  url: string;
  size: number;
  changelog: string;
}

interface LauncherFile {
  platform: string;
  filename: string;
  url: string;
  sha256: string;
  size: number;
}

interface LauncherVersion {
  version: string;
  files: LauncherFile[];
  changelog: string;
  mandatory: boolean;
  released_at: string;
}

type Platform = 'windows' | 'linux' | 'macos' | 'unknown';

/**
 * Detect user's operating system from browser user agent
 */
function detectOS(): Platform {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform?.toLowerCase() || '';

  if (platform.includes('win') || userAgent.includes('windows')) return 'windows';
  if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) return 'linux';
  if (platform.includes('mac') || userAgent.includes('mac')) return 'macos';

  return 'unknown';
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
  const [launcherVersion, setLauncherVersion] = useState<LauncherVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [splashText, setSplashText] = useState("");
  const [trailSnowflakes, setTrailSnowflakes] = useState<TrailSnowflake[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('windows');
  const [detectedOS, setDetectedOS] = useState<Platform>('unknown');
  
  // Music State
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Visualizer State
  const [snowLimit, setSnowLimit] = useState(50); // Base snow count
  const logoScale = useMotionValue(1);
  const logoRotate = useMotionValue(0);
  
  // Audio refs
  const hoverSound = useRef<HTMLAudioElement | null>(null);
  const clickSound = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  
  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const requestRef = useRef<number | null>(null);
  
  const trailIdRef = useRef(0);
  const lastTrailTimeRef = useRef(0);

  useEffect(() => {
    // Detect OS and set selected platform
    const os = detectOS();
    setDetectedOS(os);
    if (os !== 'unknown') {
      setSelectedPlatform(os);
    }

    // Initialize random splash text
    const now = new Date();
    const isWednesday = now.getDay() === 3; // 0 = Sunday, 3 = Wednesday

    if (isWednesday) {
       // 20% chance to override with wednesday meme on wednesdays
       if (Math.random() < 0.2) {
           setSplashText(WEDNESDAY_SPLASH);
       } else {
           setSplashText(SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)]);
       }
    } else {
       // Filter out wednesday meme from normal pool just in case it's in there
       const filteredSplash = SPLASH_TEXTS.filter(t => t !== "it is wednesday my dudes");
       setSplashText(filteredSplash[Math.floor(Math.random() * filteredSplash.length)]);
    }

    // Initialize audio
    hoverSound.current = new Audio('/misc/hover.ogg');
    clickSound.current = new Audio('/misc/clicksound.ogg');
    hoverSound.current.volume = 0.5;
    clickSound.current.volume = 0.5;

    // Initialize Music
    const music = new Audio('/8-bit-christmas.mp3');
    music.loop = true;
    music.volume = musicVolume;
    musicRef.current = music;

    // Setup Web Audio API
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      
      // Configure analyser
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      const source = audioCtx.createMediaElementSource(music);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      
      // Analysis loop
      const updateVisuals = () => {
        if (!analyser) return;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume (intensity)
        // Focus on bass frequencies for the bounce (lower indexes)
        let bassSum = 0;
        let bassCount = 0;
        for (let i = 0; i < 10; i++) {
            bassSum += dataArray[i];
            bassCount++;
        }
        const bassAverage = bassSum / bassCount;
        
        // Calculate overall average for snow
        let totalSum = 0;
        for(let i=0; i < dataArray.length; i++) {
            totalSum += dataArray[i];
        }
        const totalAverage = totalSum / dataArray.length;
        
        // Update Logo - Map 0-255 to 1.0-1.2 scale
        // Normalize bass: typically music hovers around 100-180 for bass hits
        const normalizedBass = Math.max(0, (bassAverage - 100) / 100); 
        const targetScale = 1 + (normalizedBass * 0.15);
        
        // Smoothly interpolate
        const currentScale = logoScale.get();
        logoScale.set(currentScale + (targetScale - currentScale) * 0.2);
        
        // Subtle rotation on beat
        const targetRotate = normalizedBass * 2 * (Math.random() > 0.5 ? 1 : -1);
        const currentRotate = logoRotate.get();
        logoRotate.set(currentRotate + (targetRotate - currentRotate) * 0.1);
        
        // Update Snow Count - Map 0-255 to 50-300 flakes
        const normalizedTotal = Math.max(0, totalAverage / 128); // 0 to ~2
        const targetSnow = 50 + Math.floor(normalizedTotal * 250);
        
        // Only update state if difference is significant to avoid thrashing
        setSnowLimit(prev => {
            const diff = Math.abs(prev - targetSnow);
            if (diff > 10) return Math.floor(prev + (targetSnow - prev) * 0.1);
            return prev;
        });
        
        requestRef.current = requestAnimationFrame(updateVisuals);
      };
      
      requestRef.current = requestAnimationFrame(updateVisuals);
      
    } catch (e) {
      console.error("Web Audio API initialization failed", e);
    }

    // Attempt auto-play
    const playPromise = music.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          console.log("Autoplay prevented by browser policy");
          setIsPlaying(false);
        });
    }

    // Fetch manifest metadata (JSON) - NOT the installer file
    api.get('/launcher/manifest/latest')
      .then(res => {
        const data = res.data;
        // Check if it's the new multi-platform format
        if (data.files && Array.isArray(data.files)) {
          setLauncherVersion(data);
        } else {
          // Old format backward compatibility
          setManifest(data);
        }
      })
      .catch(err => console.error('Failed to fetch launcher manifest:', err))
      .finally(() => setIsLoading(false));

    return () => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Handle volume changes
  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume = isMusicMuted ? 0 : musicVolume;
    }
  }, [musicVolume, isMusicMuted]);

  const toggleMute = () => {
    if (!musicRef.current) return;
    
    // Resume audio context if suspended (browser policy)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
    
    if (!isPlaying) {
      // First interaction start
      musicRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
    
    setIsMusicMuted(!isMusicMuted);
  };

  const handleInteraction = () => {
    // Resume audio context if suspended
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
    
    // Try to start music on any page click if it was blocked
    if (musicRef.current && !isPlaying) {
        musicRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

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
    handleInteraction();
  };

  // Generate snowflakes (Maximum possible)
  const snowflakes = useMemo(() => {
    const flakes: Snowflake[] = [];
    // Generate up to 300 potential flakes
    for (let i = 0; i < 300; i++) {
      flakes.push({
        id: i,
        left: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 10 + 8}s`, 
        animationDelay: `${Math.random() * 15}s`,
        size: Math.random() * 6 + 4, 
        opacity: Math.random() * 0.6 + 0.4,
      });
    }
    return flakes;
  }, []);

  // Platform-specific installation instructions
  const instructions: Record<Platform, string[]> = {
    windows: [
      "1. Run WOWID3Launcher.exe",
      "2. Follow the installation wizard",
      "3. Launch from Start Menu or Desktop shortcut"
    ],
    linux: [
      "1. Make the file executable: chmod +x WOWID3Launcher-*.AppImage",
      "2. Run the launcher: ./WOWID3Launcher-*.AppImage",
      "3. Optional: Add to applications menu"
    ],
    macos: [
      "1. Open the .dmg file",
      "2. Drag WOWID3 Launcher to Applications",
      "3. Launch from Applications folder"
    ],
    unknown: [
      "Please select your operating system above"
    ]
  };

  // Get platform-specific installer file from launcher version
  const selectedFile = launcherVersion?.files.find(f =>
    f.platform === selectedPlatform &&
    (f.file_type === 'installer' || !f.file_type) // installer or unspecified (backward compat)
  );

  // Use installer endpoint for downloads
  const downloadUrl = selectedFile
    ? `/api/launcher/latest/installer/${selectedPlatform}`
    : manifest
    ? `/files/launcher/WOWID3Launcher.exe`
    : '#';

  const fileSize = selectedFile?.size || manifest?.size || 0;
  const versionNumber = launcherVersion?.version || manifest?.version || 'unknown';

  return (
    <div 
      className="min-h-screen flex flex-col relative overflow-hidden font-sans text-white selection:bg-yellow-400 selection:text-black"
      style={{
        backgroundImage: "url('/background/bgloadscreen.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        cursor: "url('/misc/cursor.png'), auto"
      }}
      onClick={handleInteraction}
    >
      {/* Hidden Loo Easter Egg */}
      <div className="absolute top-1/4 left-10 pointer-events-none z-0 opacity-20 blur-[2px] mix-blend-overlay animate-pulse">
        <img src="/Christmas-Loo.png" alt="" className="w-64 h-auto rotate-12 transform" />
      </div>

      {/* Music Player Widget */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-[#003366]/90 backdrop-blur-md p-3 rounded-2xl border-2 border-white shadow-xl group transition-all hover:scale-105">
        <button 
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className="text-white hover:text-yellow-400 transition-colors"
        >
          {isMusicMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <div className="flex flex-col w-24">
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider mb-1 truncate">8-bit Christmas</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={isMusicMuted ? 0 : musicVolume}
              onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setMusicVolume(val);
                  if (val > 0) setIsMusicMuted(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-1.5 w-full bg-black/40 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:hover:bg-yellow-400"
            />
        </div>
      </div>

      {/* Snow - DOM elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 5 }}>
        {snowflakes.map((flake, index) => (
          <div
            key={flake.id}
            className="absolute animate-snowfall"
            style={{
              display: index < snowLimit ? 'block' : 'none',
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
            <motion.img 
              src="/logo.png" 
              alt="WOW IS DEAD 3 Logo" 
              className="h-32 md:h-56 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]" 
              style={{ scale: logoScale, rotate: logoRotate }}
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

          {/* Platform Selector Tabs */}
          {launcherVersion && (
            <div className="relative z-20 mb-8">
              <div className="flex justify-center gap-3">
                {(['windows', 'linux', 'macos'] as Platform[]).map((platform) => {
                  const platformFile = launcherVersion.files.find(f => f.platform === platform);
                  const isAvailable = !!platformFile;
                  const isSelected = selectedPlatform === platform;
                  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

                  return (
                    <button
                      key={platform}
                      onClick={() => isAvailable && setSelectedPlatform(platform)}
                      disabled={!isAvailable}
                      className={`px-6 py-3 rounded-xl font-bold text-lg transition-all border-4 ${
                        isSelected
                          ? 'bg-yellow-400 text-black border-white shadow-[0_8px_0_rgba(0,0,0,0.5)] scale-105'
                          : isAvailable
                          ? 'bg-[#003366] text-white border-white/40 hover:border-white shadow-[0_4px_0_rgba(0,0,0,0.5)] hover:scale-105'
                          : 'bg-gray-600 text-gray-400 border-gray-500 opacity-50 cursor-not-allowed'
                      }`}
                      style={{ textShadow: isSelected ? '2px 2px 0 #000' : 'none' }}
                      onMouseEnter={isAvailable ? playHover : undefined}
                    >
                      {platformLabel}
                      {!isAvailable && ' (Coming Soon)'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Download Button */}
          <div className="relative z-20 mb-16">
            <a
              href={downloadUrl}
              className={`group block relative w-96 h-40 md:w-[32rem] md:h-48 transition-transform duration-100 active:scale-95 ${
                (!manifest && !launcherVersion) || isLoading || !selectedFile
                  ? 'opacity-50 cursor-not-allowed grayscale'
                  : ''
              }`}
              onMouseEnter={playHover}
              onClick={(e) => {
                if ((!manifest && !launcherVersion) || isLoading || !selectedFile) {
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
              <div className="absolute inset-0 flex flex-col items-center justify-center pb-2 pointer-events-none">
                <span className="text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.8)]" style={{ textShadow: '3px 3px 0 #000' }}>
                  {isLoading ? "LOADING..." : "DOWNLOAD"}
                </span>
              </div>

              {/* Version Badge */}
              {(launcherVersion || manifest) && (
                 <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-md border-2 border-white/20 rounded-full px-6 py-1.5 shadow-xl whitespace-nowrap pointer-events-none transition-transform group-hover:scale-105">
                   <span className="text-sm font-bold text-yellow-200 drop-shadow-md tracking-wide">
                     v{versionNumber} • {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
                     {fileSize > 0 && ` • ${(fileSize / (1024 * 1024)).toFixed(1)} MB`}
                   </span>
                 </div>
              )}
            </a>
          </div>

          {/* Guild Secrets Grid */}
          <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl px-4">
            <FeatureModal
              imgSrc="/buttons/spbutton.png"
              title="Shadow Company"
              description="Duskwood's #1 (and only) guild. We left because the Auction House prices were a crime against humanity."
            />
            <FeatureModal
              imgSrc="/buttons/optionbutton.png"
              title="State of WoW"
              description="Dragonflight? More like Dragon-mid. We made our own fun with 200+ mods and zero microtransactions."
            />
            <FeatureModal
              imgSrc="/buttons/mpbutton.png"
              title="Powered by Loo"
              description="Our AI overlord Loothing watches from the shadows. He knows what you did in Goldshire Inn."
            />
          </div>

          {/* Installation Instructions */}
          {(launcherVersion || manifest) && selectedPlatform !== 'unknown' && (
            <div className="mt-12 w-full max-w-3xl px-4">
              <div className="bg-[#003366]/80 backdrop-blur-md border-4 border-white rounded-2xl p-6 shadow-xl">
                <h3 className="text-2xl font-black text-yellow-400 mb-4 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]" style={{ textShadow: '2px 2px 0 #000' }}>
                  Installation Instructions ({selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)})
                </h3>
                <ul className="space-y-2">
                  {instructions[selectedPlatform].map((instruction, idx) => (
                    <li key={idx} className="text-white/90 font-medium text-left">
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

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
