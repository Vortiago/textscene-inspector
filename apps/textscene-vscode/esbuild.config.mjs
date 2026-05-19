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
import cssModulesPlugin from 'esbuild-css-modules-plugin';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const skipTests = process.argv.includes('--skip-tests');

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
 * @type {esbuild.BuildOptions}
 */
const webviewOptions = {
  entryPoints: ['src/webview/webview.ts'],
  bundle: true,
  outfile: 'dist/webview.js',
  external: ['vscode'],
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  plugins: [
    cssModulesPlugin({
      // Emit a separate dist/webview.css that the HTML links with a CSP
      // nonce instead of injecting <style> tags at runtime (CSP-incompatible).
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
  const webviewContext = await esbuild.context(webviewOptions);
  await Promise.all([extensionContext.watch(), webviewContext.watch()]);
  console.log('Watching for changes...');
} else {
  const builds = [
    esbuild.build(extensionOptions),
    esbuild.build(webviewOptions),
  ];

  if (!skipTests) {
    builds.push(esbuild.build(testOptions));
  }

  await Promise.all(builds);
}
