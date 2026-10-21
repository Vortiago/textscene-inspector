/**
 * Builds `@textscene/tscn`: one ESM bundle of the parser, its esbuild metafile (not published), one
 * declaration file that imports nothing from the workspace, and the third-party notices of the
 * code the bundle holds.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { generateDtsBundle } from 'dts-bundle-generator';
import { bundledNotices } from '../../../scripts/third-party-notices.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '../..');
const entry = resolve(packageDir, 'src/index.ts');
const outDir = resolve(packageDir, 'dist');

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

writeFileSync(
  resolve(packageDir, 'THIRD-PARTY-NOTICES.md'),
  bundledNotices(readFileSync(resolve(repoRoot, 'THIRD-PARTY-NOTICES.md'), 'utf8'), bundledSources())
);

/**
 * The files the bundle holds, as their source paths in the repository. Core's compiled file keeps
 * the copyright line of its source, and the notices name the source.
 */
function bundledSources() {
  return Object.keys(metafile.inputs).map((input) => {
    const compiled = resolve(packageDir, input);
    return { path: sourcePath(compiled), text: readFileSync(compiled, 'utf8') };
  });
}

function sourcePath(compiled) {
  const source = compiled.replace(/\/dist\/(.*)\.js$/, '/src/$1.ts');
  return relative(repoRoot, existsSync(source) ? source : compiled);
}
