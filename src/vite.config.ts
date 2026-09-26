import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Served from the domain root; change this to serve from a subpath.
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    port: 3000,
    open: false,
    allowedHosts: ['vtl.tail72897d.ts.net', '.ts.net'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react/jsx-runtime')
            ) {
              return 'react-vendor';
            }
            if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) {
              return 'mui-vendor';
            }
          }
        },
      },
    },
  },
});
