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
import { REPO_ROOT } from '../../../scripts/repoRoot.mjs';
import { bundledNotices } from '../../../scripts/third-party-notices.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ownSourceDir = resolve(packageDir, 'src');
const entry = resolve(ownSourceDir, 'index.ts');
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
  bundledNotices(readFileSync(resolve(REPO_ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8'), bundledSources())
);

/**
 * The files the bundle holds, as their source paths in the repository. Core's compiled file keeps
 * the copyright line of its source, and the notices name the source, which its source map gives.
 */
function bundledSources() {
  return Object.keys(metafile.inputs).map((input) => {
    const compiled = resolve(packageDir, input);
    return { path: relative(REPO_ROOT, sourceOf(compiled)), text: readFileSync(compiled, 'utf8') };
  });
}

/**
 * The entry is this package's own TypeScript, which has no source map and is its own source. Any
 * other file without one would put a `dist/` path in the notices, so it fails the build.
 */
function sourceOf(compiled) {
  if (compiled.startsWith(`${ownSourceDir}/`)) return compiled;
  const mapPath = `${compiled}.map`;
  if (!existsSync(mapPath)) throw new Error(`expected a source map at ${mapPath}, found none`);
  const [source] = JSON.parse(readFileSync(mapPath, 'utf8')).sources;
  return resolve(dirname(compiled), source);
}
