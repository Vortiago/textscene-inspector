/**
 * Builds `@textscene/tscn`: one ESM bundle of core's parser and engine facts, its esbuild
 * metafile (not published) and one declaration file that imports nothing from the workspace.
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { generateDtsBundle } from 'dts-bundle-generator';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(packageDir, 'src/index.ts');
const outDir = resolve(packageDir, 'dist');

const { metafile } = await build({
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
