/**
 * Sets up the test workspace by copying fixture scenes.
 * Mirrors the web app's copy-fixtures.js pattern.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Copies all test scenes from scenes/ to the test workspace.
 * @param workspaceRoot - Root directory of the test workspace
 */
export function setupTestWorkspace(workspaceRoot: string): void {
  console.log('Setting up test workspace at:', workspaceRoot);

  // Clean and create workspace directory
  try {
    rmSync(workspaceRoot, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
  mkdirSync(workspaceRoot, { recursive: true });

  // Paths relative to this file
  const scenesRoot = join(__dirname, '../../../../../scenes');
  const fixturesSource = join(scenesRoot, 'fixtures');
  const examplesSource = join(scenesRoot, 'examples');
  const fixturesTarget = join(workspaceRoot, 'fixtures');

  mkdirSync(fixturesTarget, { recursive: true });

  let copiedCount = 0;

  // Copy from scenes/fixtures/
  const fixtureFiles = readdirSync(fixturesSource).filter((file) =>
    file.endsWith('.tscn'),
  );
  for (const file of fixtureFiles) {
    copyFileSync(join(fixturesSource, file), join(fixturesTarget, file));
    copiedCount++;
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
      console.log(
        `  Copied ${textureFiles.length} texture files to fixtures/textures/`,
      );
    }
  } catch {
    // Textures directory doesn't exist yet, skip
  }

  // Copy from scenes/examples/
  const exampleFiles = readdirSync(examplesSource).filter((file) =>
    file.endsWith('.tscn'),
  );
  for (const file of exampleFiles) {
    copyFileSync(join(examplesSource, file), join(fixturesTarget, file));
    copiedCount++;
  }

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
      console.log(
        `  Copied ${materialFiles.length} material files to fixtures/materials/`,
      );
    }
  } catch {
    // Materials directory doesn't exist yet, skip
  }

  console.log(
    `  Copied ${copiedCount} scene files (${fixtureFiles.length} fixtures + ${exampleFiles.length} examples)`,
  );
}
