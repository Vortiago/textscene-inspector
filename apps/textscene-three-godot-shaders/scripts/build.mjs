/**
 * Builds `@textscene/three-godot-shaders`: one ESM bundle of core's shader module, its esbuild
 * metafile (not published), one declaration file that imports nothing from the workspace, and the
 * third-party notices of the code the bundle holds. three.js stays external, so the consumer's app
 * has one copy of it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildNodeBundles, packageLayout, writeBesideBundle } from '../../../scripts/packageBuild.mjs';

const layout = packageLayout(import.meta.url);
const manifest = JSON.parse(readFileSync(resolve(layout.packageDir, 'package.json'), 'utf8'));

const metafile = await buildNodeBundles(layout, {
  entries: [{ in: layout.entry, out: 'index' }],
  external: Object.keys(manifest.peerDependencies),
  platform: 'neutral',
});
writeBesideBundle(layout, metafile);
