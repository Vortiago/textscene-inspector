/**
 * Builds `@textscene/renderer`: one ESM bundle of the renderer with its styles inside, its esbuild
 * metafile (not published), one declaration file that imports nothing from the workspace, and the
 * third-party notices of the code the bundle holds. React, three.js and their ecosystem stay
 * external, so the consumer's app has one copy of each.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { packageLayout, writeBesideBundle } from '../../../scripts/packageBuild.mjs';
import { injectStyles } from './injectStyles.mjs';

const layout = packageLayout(import.meta.url);

const manifest = JSON.parse(readFileSync(resolve(layout.packageDir, 'package.json'), 'utf8'));
const external = [...Object.keys(manifest.peerDependencies), ...Object.keys(manifest.dependencies)];

const { metafile, outputFiles } = await build({
  absWorkingDir: layout.packageDir,
  entryPoints: [layout.entry],
  outfile: resolve(layout.outDir, 'index.js'),
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  legalComments: 'inline',
  metafile: true,
  external,
});

// esbuild emits the CSS Modules of the bundle as one stylesheet. The bundle adds it to the page
// itself, so a consumer needs no CSS handling.
rmSync(layout.outDir, { recursive: true, force: true });
mkdirSync(layout.outDir, { recursive: true });
const output = (extension) => outputFiles.find(({ path }) => path.endsWith(extension));
writeFileSync(
  resolve(layout.outDir, 'index.js'),
  injectStyles(output('.js').text, output('.css')?.text ?? '')
);
writeBesideBundle(layout, metafile);
