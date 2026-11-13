/**
 * Builds `@textscene/three-godot-shaders`: one ESM bundle of core's shader module, its esbuild
 * metafile (not published), one declaration file that imports nothing from the workspace, and the
 * third-party notices of the code the bundle holds. three.js stays external, so the consumer's app
 * has one copy of it.
 */

import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { packageLayout, writeBesideBundle } from '../../../scripts/packageBuild.mjs';

const layout = packageLayout(import.meta.url);
const manifest = JSON.parse(readFileSync(resolve(layout.packageDir, 'package.json'), 'utf8'));

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
  external: Object.keys(manifest.peerDependencies),
});
writeBesideBundle(layout, metafile);
