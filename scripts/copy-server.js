// Copies server/ -> dist/ after Vite build
import fs from 'fs';
import path from 'path';

const from = path.resolve('server');
const to = path.resolve('dist');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(from)) {
  console.error('server/ folder not found');
  process.exit(1);
}
if (!fs.existsSync(to)) {
  console.error('dist/ folder not found — run build first');
  process.exit(1);
}

copyDir(from, to);
console.log('✅ Copied server/ -> dist/');
