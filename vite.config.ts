import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // This is critical for GitHub Pages (relative paths)
  build: {
    outDir: 'dist',
  }
});