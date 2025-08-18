import { resolve } from 'path';

export default {
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { open: true },
};
