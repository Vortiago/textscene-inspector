/**
 * esbuild configuration for the extension and the webview. The webview build emits
 * the `*.module.css` of core's R3F components as a separate CSS bundle, which the
 * webview HTML links with the CSP nonce so it loads under VS Code's CSP.
 */
import * as esbuild from 'esbuild';
import { rm, writeFile } from 'node:fs/promises';
import cssModulesPlugin from 'esbuild-css-modules-plugin';
import { globSync } from 'glob';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const skipTests = process.argv.includes('--skip-tests');

// esbuild never deletes old outputs. Content-hashed chunks pile up in dist/webview
// and get packaged into the VSIX.
await rm('dist/webview', { recursive: true, force: true });
// A deleted `*.test.ts` leaves a `.test.js` here that suite/index.ts still globs.
// Nothing else emits into dist/test (tsconfig.test.json is noEmit).
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
  // The metafile lists every module bundled into the host. Written to
  // dist/*.meta.json, it lets `scripts/check-bundle-size.mjs` assert that no
  // react/three module is in, rather than scan the minified output for tokens.
  metafile: true,
};

/**
 * Web extension host build (vscode.dev). A web host loads one CommonJS-shaped file
 * in a worker, so this mirrors the Node build but for `platform: 'browser'`. That
 * switch is also the guard: a Node-builtin import in the host graph fails this
 * build rather than breaking at runtime.
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
 * This build only produces `dist/webview/`. The initial-paint budget gate
 * (main + 200 KB gzipped) lives in `scripts/check-bundle-size.mjs`, run by the
 * root `check:bundle-size` script. ARCHITECTURE.md, "Bundle Size Target", has
 * the numbers and why the gate is informational.
 *
 * @type {esbuild.BuildOptions}
 */
const webviewOptions = {
  entryPoints: ['src/webview/webview.ts'],
  bundle: true,
  // ESM, not iife, because only ESM code-splits: the DOM panels and their
  // drei/three.js dependencies load on demand as chunks/<panel>-<hash>.js beside
  // the initial webview.js and webview.css. The HTML loads it as a module script,
  // and the CSP allows the chunks through `script-src ${cspSource}` (webviewHtml.ts).
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
 * Integration-test build. The extension host loads suite/index by path, and it
 * globs `**\/*.test.js` beside itself, so each runtime-loaded file is its own
 * entry and the suites are globbed. Their imports, core included, are bundled:
 * core's dist is bundler-only ESM (extensionless imports), which Node cannot load.
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
