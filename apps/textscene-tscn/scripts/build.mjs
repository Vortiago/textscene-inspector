/**
 * Builds `@textscene/tscn`: one ESM bundle of core's parser and engine facts, one declaration
 * file with no import from the workspace, and the third-party notices the bundle must carry.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');

await build({
  entryPoints: [resolve(packageDir, 'src/index.ts')],
  outfile: resolve(packageDir, 'dist/index.js'),
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  target: 'es2022',
  legalComments: 'inline',
});

execFileSync(
  process.execPath,
  [
    resolve(packageDir, 'node_modules/dts-bundle-generator/dist/bin/dts-bundle-generator.js'),
    '--project',
    resolve(packageDir, 'tsconfig.json'),
    '--no-banner',
    '--export-referenced-types=false',
    '--out-file',
    resolve(packageDir, 'dist/index.d.ts'),
    resolve(packageDir, 'src/index.ts'),
  ],
  { stdio: 'inherit' }
);

copyFileSync(resolve(repoRoot, 'THIRD-PARTY-NOTICES.md'), resolve(packageDir, 'THIRD-PARTY-NOTICES.md'));
