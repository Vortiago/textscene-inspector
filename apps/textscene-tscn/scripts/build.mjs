/**
 * Builds `@textscene/tscn`: one ESM bundle of the parser, its esbuild metafile (not published), one
 * declaration file that imports nothing from the workspace, and the third-party notices of the
 * code the bundle holds.
 */

import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { packageLayout, writeBesideBundle } from '../../../scripts/packageBuild.mjs';

const layout = packageLayout(import.meta.url);

// A clean dist, so no file of an earlier build reaches the tarball.
rmSync(layout.outDir, { recursive: true, force: true });
const { metafile } = await build({
  absWorkingDir: layout.packageDir,
  entryPoints: [layout.entry],
  outfile: resolve(layout.outDir, 'index.js'),
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  target: 'es2022',
  legalComments: 'inline',
  metafile: true,
});
writeBesideBundle(layout, metafile);
