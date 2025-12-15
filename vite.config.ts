import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Replace 'gept' with your repository name if it changes
  base: '/gept/', 
  build: {
    outDir: 'dist',
  }
});
