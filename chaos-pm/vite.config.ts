import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Cap warning at 600KB so the dashboard stops shouting
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // Group vendors into stable chunks so the browser caches them
          // across deploys (chunk hash only changes when the lib changes).
          if (id.includes('react-dom') || id.includes('/react/')) return 'react';
          if (id.includes('@liveblocks')) return 'liveblocks';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@sentry')) return 'sentry';
          if (id.includes('mixpanel')) return 'mixpanel';
          if (id.includes('zustand')) return 'zustand';
          return 'vendor';
        },
      },
    },
  },
});
