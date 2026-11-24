import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // BASE_PATH permite publicar numa subpasta, por ex. /nefesh-life/ no GitHub Pages
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  // versão nos avisos de falhas: a da loja (APP_VERSION, no TestFlight) ou a data da compilação
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || `web-${new Date().toISOString().slice(0, 10)}`) },
  test: { environment: 'node' },
} as any);
