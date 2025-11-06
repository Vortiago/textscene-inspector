import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
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

// Copy textures directory from scenes/fixtures/
const texturesSource = join(fixturesSource, 'textures');
const texturesTarget = join(fixturesTarget, 'textures');
try {
  if (statSync(texturesSource).isDirectory()) {
    mkdirSync(texturesTarget, { recursive: true });
    const textureFiles = readdirSync(texturesSource);
    for (const file of textureFiles) {
      copyFileSync(join(texturesSource, file), join(texturesTarget, file));
    }
    console.log(`Copied ${textureFiles.length} texture files to public/fixtures/textures/`);
  }
} catch {
  // Textures directory doesn't exist yet, skip
}

// Copy from scenes/examples/
const exampleFiles = readdirSync(examplesSource).filter((file) => file.endsWith('.tscn'));
for (const file of exampleFiles) {
  copyFileSync(join(examplesSource, file), join(fixturesTarget, file));
}

const totalFiles = fixtureFiles.length + exampleFiles.length;
console.log(`Copied ${totalFiles} scene files to public/fixtures/ (${fixtureFiles.length} fixtures + ${exampleFiles.length} examples)`);

// Copy materials directory from scenes/materials/
const materialsSource = join(scenesRoot, 'materials');
const materialsTarget = join(fixturesTarget, 'materials');
try {
  if (statSync(materialsSource).isDirectory()) {
    mkdirSync(materialsTarget, { recursive: true });
    const materialFiles = readdirSync(materialsSource);
    for (const file of materialFiles) {
      copyFileSync(join(materialsSource, file), join(materialsTarget, file));
    }
    console.log(`Copied ${materialFiles.length} material files to public/fixtures/materials/`);
  }
} catch {
  // Materials directory doesn't exist yet, skip
}
