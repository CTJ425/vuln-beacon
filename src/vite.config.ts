import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Served from the domain root when self-hosted; change this to serve from a subpath.
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
});
