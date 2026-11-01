/**
 * The steps the build of each published npm package shares around its esbuild bundle: where the
 * package keeps its files, what it builds, and what it writes beside the bundle. A package builds
 * `src/index.ts` into `dist/index.js`.
 */

import { rmSync, writeFileSync } from 'node:fs';
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
 * Builds the package's Node bundles, one per entry, into a clean `outDir`, with one metafile for
 * all of them. Each entry is `{ in, out }`: the bundle's source and its file name without
 * extension. The package installs esbuild, so the build reads it from the package's own
 * node_modules, not the repo root's.
 *
 * @canonical The esbuild build of a published package's Node bundles
 *   A clean dist, so no file of an earlier build reaches the tarball. The shared metafile is
 *   named `build.meta.json` and is not published; the declarations and notices go beside the
 *   library bundle.
 *
 * @param {ReturnType<typeof packageLayout>} layout - the package's files.
 * @param {{ entries: { in: string, out: string }[], external?: string[] }} options - the bundles
 *   to build and the packages they read from the host's node_modules at run time.
 * @returns {Promise<{ inputs: Record<string, unknown> }>} the bundles' shared esbuild metafile.
 */
export async function buildNodeBundles(layout, { entries, external = [] }) {
  const { build } = createRequire(resolve(layout.packageDir, 'package.json'))('esbuild');
  rmSync(layout.outDir, { recursive: true, force: true });
  const { metafile } = await build({
    absWorkingDir: layout.packageDir,
    entryPoints: entries,
    outdir: layout.outDir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    legalComments: 'inline',
    metafile: true,
    external,
  });
  return metafile;
}

/**
 * Writes the bundle's metafile, which is not published, and one declaration file that imports
 * nothing from the workspace into `outDir`, then the notices of the third-party code the bundle
 * holds. A build of several bundles names `metafileName` for their shared one, and turns
 * `notices` off while its package ships none.
 *
 * @param {ReturnType<typeof packageLayout>} layout - the package's files.
 * @param {{ inputs: Record<string, unknown> }} metafile - the esbuild metafile of the bundle.
 * @param {{ metafileName?: string, notices?: boolean }} [options]
 */
export function writeBesideBundle(
  { packageDir, ownSourceDir, entry, outDir },
  metafile,
  { metafileName = 'index.meta.json', notices = true } = {}
) {
  writeFileSync(resolve(outDir, metafileName), JSON.stringify(metafile));
  writeFileSync(resolve(outDir, 'index.d.ts'), bundledDeclarations(packageDir, entry));
  if (notices) writeBundledNotices(metafile, { packageDir, ownSourceDir });
}

/**
 * The declarations of `entry` in one file, with every workspace type it names inlined, so the file
 * imports nothing from the workspace. Each published package installs the generator itself, and its
 * own tsconfig answers the type resolution.
 */
function bundledDeclarations(packageDir, entry) {
  const requireFromPackage = createRequire(resolve(packageDir, 'package.json'));
  const { generateDtsBundle } = requireFromPackage('dts-bundle-generator');
  const [declarations] = generateDtsBundle(
    [{ filePath: entry, output: { noBanner: true, exportReferencedTypes: false } }],
    { preferredConfigPath: resolve(packageDir, 'tsconfig.json') }
  );
  return declarations;
}
