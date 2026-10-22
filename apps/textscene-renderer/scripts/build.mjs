/**
 * Builds `@textscene/renderer`: one ESM bundle of the renderer with its styles inside, its esbuild
 * metafile (not published), one declaration file that imports nothing from the workspace, and the
 * third-party notices of the code the bundle holds. React, three.js and their ecosystem stay
 * external, so the consumer's app has one copy of each.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { generateDtsBundle } from 'dts-bundle-generator';
import { REPO_ROOT } from '../../../scripts/repoRoot.mjs';
import { bundledNotices, bundledSourceFiles } from '../../../scripts/third-party-notices.mjs';
import { injectStyles } from './injectStyles.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ownSourceDir = resolve(packageDir, 'src');
const entry = resolve(ownSourceDir, 'index.ts');
const outDir = resolve(packageDir, 'dist');

const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'));
const external = [...Object.keys(manifest.peerDependencies), ...Object.keys(manifest.dependencies)];

const { metafile, outputFiles } = await build({
  absWorkingDir: packageDir,
  entryPoints: [entry],
  outfile: resolve(outDir, 'index.js'),
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
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const output = (extension) => outputFiles.find(({ path }) => path.endsWith(extension));
writeFileSync(resolve(outDir, 'index.js'), injectStyles(output('.js').text, output('.css')?.text ?? ''));
writeFileSync(resolve(outDir, 'index.meta.json'), JSON.stringify(metafile));

const [declarations] = generateDtsBundle(
  [{ filePath: entry, output: { noBanner: true, exportReferencedTypes: false } }],
  { preferredConfigPath: resolve(packageDir, 'tsconfig.json') }
);
writeFileSync(resolve(outDir, 'index.d.ts'), declarations);

writeFileSync(
  resolve(packageDir, 'THIRD-PARTY-NOTICES.md'),
  bundledNotices(
    readFileSync(resolve(REPO_ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8'),
    bundledSourceFiles(metafile, { packageDir, ownSourceDir })
  )
);
