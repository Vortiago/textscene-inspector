import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesSource = join(__dirname, '../../../tests/fixtures');
const fixturesTarget = join(__dirname, '../public/fixtures');

mkdirSync(fixturesTarget, { recursive: true });

const files = readdirSync(fixturesSource).filter((file) => file.endsWith('.tscn'));

for (const file of files) {
  copyFileSync(join(fixturesSource, file), join(fixturesTarget, file));
}

console.log(`Copied ${files.length} fixture files to public/fixtures/`);
