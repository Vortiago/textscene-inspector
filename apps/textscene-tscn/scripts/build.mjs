/**
 * Builds `@textscene/tscn`: one ESM bundle of the parser, its esbuild metafile (not published), one
 * declaration file that imports nothing from the workspace, and the third-party notices of the
 * code the bundle holds.
 */

import { rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { generateDtsBundle } from 'dts-bundle-generator';
import { writeBundledNotices } from '../../../scripts/third-party-notices.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ownSourceDir = resolve(packageDir, 'src');
const entry = resolve(ownSourceDir, 'index.ts');
const outDir = resolve(packageDir, 'dist');

// A clean dist, so no file of an earlier build reaches the tarball.
rmSync(outDir, { recursive: true, force: true });
const { metafile } = await build({
  absWorkingDir: packageDir,
  entryPoints: [entry],
  outfile: resolve(outDir, 'index.js'),
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  target: 'es2022',
  legalComments: 'inline',
  metafile: true,
});
writeFileSync(resolve(outDir, 'index.meta.json'), JSON.stringify(metafile));

const [declarations] = generateDtsBundle(
  [{ filePath: entry, output: { noBanner: true, exportReferencedTypes: false } }],
  { preferredConfigPath: resolve(packageDir, 'tsconfig.json') }
);
writeFileSync(resolve(outDir, 'index.d.ts'), declarations);

writeBundledNotices(metafile, { packageDir, ownSourceDir });
