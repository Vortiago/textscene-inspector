/**
 * The steps the build of each published npm package shares around its esbuild bundle: where the
 * package keeps its files, and what it writes beside the bundle. A package builds `src/index.ts`
 * into `dist/index.js`.
 */

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBundledNotices } from './third-party-notices.mjs';

/**
 * @param {string} buildScriptUrl - the `import.meta.url` of the package's `scripts/build.mjs`.
 * @returns {{ packageDir: string, ownSourceDir: string, entry: string, outDir: string }} the
 *   package, its own TypeScript, the bundle's entry and the directory the bundle goes to.
 */
export function packageLayout(buildScriptUrl) {
  const packageDir = resolve(dirname(fileURLToPath(buildScriptUrl)), '..');
  const ownSourceDir = resolve(packageDir, 'src');
  return {
    packageDir,
    ownSourceDir,
    entry: resolve(ownSourceDir, 'index.ts'),
    outDir: resolve(packageDir, 'dist'),
  };
}

/**
 * Writes the bundle's metafile, which is not published, and one declaration file that imports
 * nothing from the workspace into `outDir`, then the notices of the third-party code the bundle
 * holds.
 *
 * @param {ReturnType<typeof packageLayout>} layout - the package's files.
 * @param {{ inputs: Record<string, unknown> }} metafile - the esbuild metafile of the bundle.
 */
export function writeBesideBundle({ packageDir, ownSourceDir, entry, outDir }, metafile) {
  writeFileSync(resolve(outDir, 'index.meta.json'), JSON.stringify(metafile));
  writeFileSync(resolve(outDir, 'index.d.ts'), bundledDeclarations(packageDir, entry));
  writeBundledNotices(metafile, { packageDir, ownSourceDir });
}

/** The declarations of `entry` in one file. Each package installs the generator, not the root. */
function bundledDeclarations(packageDir, entry) {
  const requireFromPackage = createRequire(resolve(packageDir, 'package.json'));
  const { generateDtsBundle } = requireFromPackage('dts-bundle-generator');
  const [declarations] = generateDtsBundle(
    [{ filePath: entry, output: { noBanner: true, exportReferencedTypes: false } }],
    { preferredConfigPath: resolve(packageDir, 'tsconfig.json') }
  );
  return declarations;
}
