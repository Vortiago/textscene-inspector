import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenesRoot = join(__dirname, '../../../scenes');
const fixturesSource = join(scenesRoot, 'fixtures');
const examplesSource = join(scenesRoot, 'examples');
const fixturesTarget = join(__dirname, '../public/fixtures');

mkdirSync(fixturesTarget, { recursive: true });

// Copy from scenes/fixtures/
const fixtureFiles = readdirSync(fixturesSource).filter((file) => file.endsWith('.tscn'));
for (const file of fixtureFiles) {
  copyFileSync(join(fixturesSource, file), join(fixturesTarget, file));
}

// Copy from scenes/examples/
const exampleFiles = readdirSync(examplesSource).filter((file) => file.endsWith('.tscn'));
for (const file of exampleFiles) {
  copyFileSync(join(examplesSource, file), join(fixturesTarget, file));
}

const totalFiles = fixtureFiles.length + exampleFiles.length;
console.log(`Copied ${totalFiles} scene files to public/fixtures/ (${fixtureFiles.length} fixtures + ${exampleFiles.length} examples)`);
