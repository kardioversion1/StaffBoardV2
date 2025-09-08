import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    headers: {
      'Content-Security-Policy': "frame-ancestors 'none'",
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': "frame-ancestors 'none'",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        adapter: resolve(__dirname, 'src/server/adapter.ts'),
      },
    },
  },
});
