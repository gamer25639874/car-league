import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
