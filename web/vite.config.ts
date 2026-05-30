import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard (static SPA) is built into ./dist and served by Cloudflare Pages.
// API + WebSocket live under /api/* and are handled by Pages Functions, so we proxy
// them to the local wrangler dev server during `vite` dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
