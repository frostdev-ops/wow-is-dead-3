import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Server, Shield, Zap, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import api from '@/api/client';

interface LauncherManifest {
  version: string;
  url: string;
  size: number;
  changelog: string;
}

export default function DownloadPage() {
  const [manifest, setManifest] = useState<LauncherManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/launcher/latest')
      .then(res => setManifest(res.data))
      .catch(err => console.error('Failed to fetch launcher manifest:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const downloadUrl = manifest ? `/files/launcher/WOWID3Launcher.exe` : '#';

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25">
            <img src="/wid3icon.png" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
            WOW IS DEAD 3
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => window.location.href = '/login'}>
            Admin Login
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-4 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="mb-8 flex justify-center">
             <img src="/logo.png" alt="WOWID3 Logo" className="h-32 md:h-48 object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-6 drop-shadow-sm">
            The Ultimate <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Modpack</span> Experience
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            A custom-crafted Minecraft modpack featuring technology, magic, and exploration. 
            Download the official launcher to join the server instantly.
          </p>

          <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-16">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg gap-3 shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all duration-300 border-primary/50 border"
                onClick={() => window.location.href = downloadUrl}
                disabled={!manifest && !isLoading}
              >
                {isLoading ? (
                  "Loading..."
                ) : (
                  <>
                    <Download className="w-6 h-6" />
                    Download for Windows
                  </>
                )}
              </Button>
            </motion.div>
            
            {manifest && (
              <div className="text-sm text-muted-foreground text-left bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Latest Version: <span className="text-white font-mono">{manifest.version}</span>
                </div>
                <div className="text-xs opacity-70">
                  {(manifest.size / 1024 / 1024).toFixed(1)} MB • exe
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 max-w-5xl w-full px-4"
        >
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-yellow-400" />}
            title="Auto-Updates"
            description="The launcher automatically keeps your game and mods up to date with the server."
          />
          <FeatureCard 
            icon={<Shield className="w-8 h-8 text-blue-400" />}
            title="Verified Integrity"
            description="Every file is hashed and verified to ensure a stable and crash-free experience."
          />
          <FeatureCard 
            icon={<Server className="w-8 h-8 text-purple-400" />}
            title="Server Synced"
            description="Direct integration with the WOWID3 server for status, players, and news."
          />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-sm text-muted-foreground border-t border-white/5 bg-black/20 backdrop-blur-sm mt-12">
        <p>© 2025 WOWID3. Not affiliated with Mojang or Microsoft.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="p-6 bg-white/5 border-white/10 hover:bg-white/10 transition-colors text-left">
      <div className="mb-4 p-3 bg-white/5 rounded-lg w-fit">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </Card>
  );
}

