import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const rules = [
  { pattern: /\bfloat\b/gi, suggest: 'flex' },
  { pattern: /\bpending\b/gi, suggest: 'draft' },
  { pattern: /\btraveler\b/gi, suggest: 'travel' },
  { pattern: /\bcontract\b/gi, suggest: 'travel' },
  { pattern: /\bcolour\b/gi, suggest: 'color' },
  { pattern: /\bfavour\b/gi, suggest: 'favor' },
  { pattern: /\borganise\b/gi, suggest: 'organize' },
  { pattern: /\bcancelled\b/gi, suggest: 'canceled' },
];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

const root = path.resolve('.');
const files = walk(root)
  .filter((f) => !f.includes('node_modules'))
  .filter((f) => /(\.ts|\.tsx|\.js|\.css|\.md)$/i.test(f));
let found = false;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      found = true;
      console.warn(`${file}: contains disallowed term; prefer "${rule.suggest}"`);
    }
  }
}
if (!found) console.log('No term issues found');
