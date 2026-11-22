import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.API_TARGET || 'http://localhost:4000';
export default defineConfig({
  plugins: [react()],
  build: { outDir: '../server/public', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': target, '/uploads': target } },
});
