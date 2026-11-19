import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // BASE_PATH permite publicar numa subpasta, por ex. /nefesh-life/ no GitHub Pages
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  test: { environment: 'node' },
} as any);
