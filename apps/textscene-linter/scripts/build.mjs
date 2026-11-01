/**
 * Builds `@textscene/linter`: the library bundle the manifest's entry point names, one declaration
 * file that imports nothing from the workspace, and the CLI bundle the `tscn-lint` bin runs. Both
 * are plain Node ESM, with no React and no three.js.
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
  entryPoints: [
    { in: resolve(layout.ownSourceDir, 'index.ts'), out: 'index' },
    { in: resolve(layout.ownSourceDir, 'cli.ts'), out: 'cli' },
  ],
  outdir: layout.outDir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'es2022',
  legalComments: 'inline',
  metafile: true,
  // commander stays the user's install: the CLI reads it from node_modules at run time.
  external: ['commander'],
});

// One metafile for both bundles, named for the build and not the one bundle, which the pack drops.
// The package ships no third-party notices.
writeBesideBundle(layout, metafile, { metafileName: 'build.meta.json', notices: false });
