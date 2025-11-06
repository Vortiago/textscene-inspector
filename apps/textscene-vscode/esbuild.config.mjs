/**
 * esbuild configuration for bundling the extension and webview
 */
import * as esbuild from 'esbuild';

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
