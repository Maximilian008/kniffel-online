import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// During development the game server runs in `wrangler dev` on port 8787 (see `pnpm dev`).
export default defineConfig({
  plugins: [react()],
  server: {
    open: false,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
