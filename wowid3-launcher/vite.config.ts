import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'skinview3d'],
          react: ['react', 'react-dom', 'framer-motion'],
        },
      },
      onwarn(warning, warn) {
        // Suppress warnings about unresolved fonts in public folder
        if (warning.message?.includes('minecraftia-regular.ttf')) {
          return;
        }
        warn(warning);
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri` and game data directories
      ignored: (path: string) => {
        // Ignore all node_modules
        if (path.includes("node_modules")) return true;
        // Ignore Tauri source
        if (path.includes("src-tauri")) return true;
        // Ignore all game installation directories
        if (path.includes("game") && !path.includes("game_")) return true;
        if (path.includes(".minecraft")) return true;
        if (path.includes("minecraft")) return true;
        if (path.includes("versions")) return true;
        if (path.includes("libraries")) return true;
        if (path.includes("assets")) return true;
        if (path.includes("natives")) return true;
        if (path.includes(".cache")) return true;
        return false;
      },
    },
  },
}));
