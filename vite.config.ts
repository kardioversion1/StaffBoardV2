import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
});
