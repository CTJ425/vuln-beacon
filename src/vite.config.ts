import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // GitHub Pages project sites are served from /<repo>/, not /.
  // Only the CI Pages build sets GH_PAGES; local dev/build stays at '/'.
  base: process.env.GH_PAGES ? '/vuln-beacon/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
