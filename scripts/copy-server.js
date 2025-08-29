// Copies API and related files to dist after Vite build
import fs from 'fs';
import path from 'path';

const files = ['api.php', 'reset.php', 'server-adapter.js', '.htaccess'];
const dist = path.resolve('dist');

if (!fs.existsSync(dist)) {
  console.error('dist/ folder not found — run build first');
  process.exit(1);
}

for (const f of files) {
  const src = path.resolve(f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dist, f));
  }
}

console.log('✅ Copied server files to dist/');
