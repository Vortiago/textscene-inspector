/**
 * Copy `*.module.css` files from src/ to dist/ after the tsc build, which ignores them. The
 * compiled .js keeps its relative `./Foo.module.css` imports, which Vite and esbuild resolve at
 * runtime, so the copy mirrors the directory layout.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(pkgRoot, 'src');
const distRoot = path.join(pkgRoot, 'dist');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith('.module.css')) {
      out.push(full);
    }
  }
  return out;
}

const files = await walk(srcRoot);
let copied = 0;
for (const srcFile of files) {
  const rel = path.relative(srcRoot, srcFile);
  const destFile = path.join(distRoot, rel);
  await fs.mkdir(path.dirname(destFile), { recursive: true });
  await fs.copyFile(srcFile, destFile);
  copied += 1;
}

console.log(`Copied ${copied} CSS Module file${copied === 1 ? '' : 's'} to dist/`);
