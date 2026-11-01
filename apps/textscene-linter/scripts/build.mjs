/**
 * Builds `@textscene/linter`: the library bundle the manifest's entry point names, one declaration
 * file that imports nothing from the workspace, the CLI bundle the `tscn-lint` bin runs, and the
 * third-party notices of the code both bundles hold. Both are plain Node ESM, with no React and no
 * three.js.
 */

import { resolve } from 'node:path';
import { buildNodeBundles, packageLayout, writeBesideBundle } from '../../../scripts/packageBuild.mjs';

const layout = packageLayout(import.meta.url);

const metafile = await buildNodeBundles(layout, {
  entries: [
    { in: resolve(layout.ownSourceDir, 'index.ts'), out: 'index' },
    { in: resolve(layout.ownSourceDir, 'cli.ts'), out: 'cli' },
  ],
  // commander stays the user's install: the CLI reads it from node_modules at run time.
  external: ['commander'],
});

// One metafile for both bundles, named for the build and not the one bundle; the pack drops it.
writeBesideBundle(layout, metafile, { metafileName: 'build.meta.json' });
