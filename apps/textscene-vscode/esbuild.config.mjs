/**
 * esbuild configuration for bundling the extension and webview.
 *
 * The webview build uses esbuild-css-modules-plugin so that `*.module.css`
 * files imported from `@textscene/core` (the R3F components added in
 * WI-R3F-1 onward) emit a separate CSS bundle alongside the JS bundle.
 * The webview HTML links that CSS file with the CSP nonce so it loads
 * under VS Code's restrictive content-security policy.
 */
import * as esbuild from 'esbuild';
import { rm } from 'node:fs/promises';
import cssModulesPlugin from 'esbuild-css-modules-plugin';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const skipTests = process.argv.includes('--skip-tests');

// The webview build emits content-hashed chunks (chunks/[name]-[hash].js).
// esbuild never deletes outputs from previous builds, so stale chunks
// accumulate in dist/webview/chunks/ and would get packaged into the VSIX.
// Clear the webview output dir up front so every build starts clean.
await rm('dist/webview', { recursive: true, force: true });

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
  // WI-R3F-18: ESM + splitting. The previous `format: 'iife'` couldn't
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
 * @type {esbuild.BuildOptions}
 */
const testOptions = {
  entryPoints: [
    'src/test/integration/runTests.ts',
    'src/test/integration/setupWorkspace.ts',
    'src/test/integration/suite/index.ts',
    'src/test/integration/suite/extension.test.ts',
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

  await Promise.all(builds);
}
