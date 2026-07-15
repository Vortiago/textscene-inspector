/**
 * esbuild configuration for bundling the extension and webview.
 *
 * The webview build uses esbuild-css-modules-plugin so that `*.module.css`
 * files imported from `@textscene/core` (the R3F components) emit a
 * separate CSS bundle alongside the JS bundle.
 * The webview HTML links that CSS file with the CSP nonce so it loads
 * under VS Code's restrictive content-security policy.
 */
import * as esbuild from 'esbuild';
import { rm, writeFile } from 'node:fs/promises';
import cssModulesPlugin from 'esbuild-css-modules-plugin';
import { globSync } from 'glob';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const skipTests = process.argv.includes('--skip-tests');

// esbuild never deletes outputs from previous builds, so both build dirs
// accumulate stale files across runs:
//   - dist/webview: content-hashed chunks (chunks/[name]-[hash].js) pile up
//     and would get packaged into the VSIX.
//   - dist/test: the integration-test build (outdir 'dist' + outbase 'src')
//     emits every suite into dist/test/..., so a deleted or renamed
//     `*.test.ts` leaves a compiled `.test.js` behind that suite/index.ts
//     still globs and runs locally (CI is immune — it builds a fresh
//     checkout). Nothing else emits into dist/test (tsconfig.test.json is
//     noEmit), so clearing it wholesale is safe.
// Clear both output dirs up front so every build starts clean.
await rm('dist/webview', { recursive: true, force: true });
await rm('dist/test', { recursive: true, force: true });

/**
 * @type {esbuild.BuildOptions}
 */
const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  // The metafile lists every input module bundled into the host — written
  // to dist/*.meta.json below so `scripts/check-bundle-size.mjs` can assert
  // precisely that no react/three module was pulled in, instead of
  // heuristically token-scanning the minified output.
  metafile: true,
};

/**
 * Web extension host build (vscode.dev / VS Code for Web).
 *
 * Web extension hosts load a single CommonJS-shaped file in a web
 * worker, so this mirrors the Node extension build except for
 * `platform: 'browser'`. That platform switch is also the guard: any
 * Node-builtin import sneaking into the extension-host graph makes
 * this build fail loudly instead of breaking silently at runtime.
 *
 * @type {esbuild.BuildOptions}
 */
const extensionWebOptions = {
  ...extensionOptions,
  outfile: 'dist/extension.web.js',
  platform: 'browser',
  target: 'es2020',
};

/**
 * @type {esbuild.BuildOptions}
 *
 * The webview initial-paint budget gate (main + 200 KB gzipped) is NOT
 * enforced here — this file only produces `dist/webview/`. The gate itself
 * lives in `scripts/check-bundle-size.mjs`, invoked via the root
 * `check:bundle-size` npm script (see ARCHITECTURE.md, "Bundle Size
 * Target", for current numbers and why it's still informational).
 */
const webviewOptions = {
  entryPoints: ['src/webview/webview.ts'],
  bundle: true,
  // ESM + splitting. The previous `format: 'iife'` couldn't
  // code-split, which forced every transitive import of the entry into
  // the single `webview.js` bundle — including the (large) DOM panels
  // we'd ideally lazy-load. ESM + splitting moves those panels (and
  // their drei/three.js dependencies) into separate chunks that load
  // on demand via dynamic `import()`. The dist layout becomes:
  //   dist/webview/webview.js                — initial chunk
  //   dist/webview/chunks/<panel>-<hash>.js  — lazy chunks
  //   dist/webview/webview.css               — co-located CSS
  // The HTML uses `<script type="module">` and the CSP allows
  // chunk URIs via `script-src ${cspSource}` (see webviewHtml.ts).
  outdir: 'dist/webview',
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  external: ['vscode'],
  format: 'esm',
  splitting: true,
  platform: 'browser',
  target: 'es2020',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  plugins: [
    cssModulesPlugin({
      // Emit a separate dist/webview/webview.css that the HTML links
      // with a CSP nonce instead of injecting <style> tags at runtime
      // (CSP-incompatible).
      inject: false,
      emitDeclarationFile: true,
    }),
  ],
  loader: {
    '.css': 'css',
  },
};

/**
 * Integration-test build.
 *
 * The extension host loads these files by PATH at runtime (runTests spawns
 * Electron pointing at suite/index, which then globs `**\/*.test.js` next to
 * itself), so every runtime-loaded file must be its own entry point. The
 * `*.test.ts` entries are globbed rather than listed so a new suite file is
 * picked up automatically. Everything they import — including the real
 * `TscnPreviewPanel` and `@textscene/core` — is BUNDLED: `@textscene/core`'s
 * dist is bundler-only ESM (extensionless relative imports), so Node's own
 * resolver cannot load it from a plain tsc-compiled CJS tree; esbuild
 * resolves it exactly like the production extension bundle does.
 *
 * @type {esbuild.BuildOptions}
 */
const testOptions = {
  entryPoints: [
    'src/test/integration/runTests.ts',
    'src/test/integration/suite/index.ts',
    ...globSync('src/test/integration/suite/*.test.ts'),
  ],
  bundle: true,
  outdir: 'dist',
  external: ['vscode', 'mocha', 'glob'],
  format: 'cjs',
  platform: 'node',
  target: 'node16',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  outbase: 'src',
};

if (watch) {
  const extensionContext = await esbuild.context(extensionOptions);
  const extensionWebContext = await esbuild.context(extensionWebOptions);
  const webviewContext = await esbuild.context(webviewOptions);
  await Promise.all([
    extensionContext.watch(),
    extensionWebContext.watch(),
    webviewContext.watch(),
  ]);
  console.log('Watching for changes...');
} else {
  const builds = [
    esbuild.build(extensionOptions),
    esbuild.build(extensionWebOptions),
    esbuild.build(webviewOptions),
  ];

  if (!skipTests) {
    builds.push(esbuild.build(testOptions));
  }

  const [extensionResult, extensionWebResult] = await Promise.all(builds);
  // Persist the host builds' metafiles for the host-bundle guard.
  await Promise.all([
    writeFile('dist/extension.meta.json', JSON.stringify(extensionResult.metafile)),
    writeFile('dist/extension.web.meta.json', JSON.stringify(extensionWebResult.metafile)),
  ]);
}
