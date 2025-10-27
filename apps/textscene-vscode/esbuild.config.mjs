/**
 * esbuild configuration for bundling the extension and webview
 */
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

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
};

if (watch) {
  const extensionContext = await esbuild.context(extensionOptions);
  const webviewContext = await esbuild.context(webviewOptions);
  await Promise.all([extensionContext.watch(), webviewContext.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(extensionOptions),
    esbuild.build(webviewOptions),
  ]);
}
