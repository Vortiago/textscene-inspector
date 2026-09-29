/**
 * esbuild plugin: bundles the webview's job worker into one IIFE script and
 * exposes its text as the default export of `virtual:texture-worker-source`.
 * The webview starts the worker from a blob URL of that text, so starting it
 * fetches nothing: the CSP grants `worker-src blob:` and no `connect-src` (ADR-0042).
 */
import path from 'node:path';
import * as esbuild from 'esbuild';

export const TEXTURE_WORKER_MODULE = 'virtual:texture-worker-source';

const NAMESPACE = 'texture-worker-source';
const WORKER_ENTRY = path.resolve(import.meta.dirname, '../webview/textureWorker.ts');

/**
 * @param {{ minify: boolean }} options
 * @returns {esbuild.Plugin}
 */
export function textureWorkerPlugin({ minify }) {
  return {
    name: 'texture-worker-source',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${TEXTURE_WORKER_MODULE}$`) }, (args) => ({
        path: args.path,
        namespace: NAMESPACE,
      }));
      build.onLoad({ filter: /.*/, namespace: NAMESPACE }, async () => {
        const result = await esbuild.build({
          entryPoints: [WORKER_ENTRY],
          bundle: true,
          write: false,
          // One classic script: a blob worker has no base URL to resolve a chunk against.
          format: 'iife',
          platform: 'browser',
          target: 'es2020',
          minify,
          metafile: true,
          // Core's TS source, the code its dist compiles, so the worker builds without a dist.
          conditions: ['@textscene/source'],
          logLevel: 'silent',
        });
        const [output] = result.outputFiles;
        if (!output) throw new Error(`expected one worker bundle from ${WORKER_ENTRY}, got none`);
        return {
          contents: `export default ${JSON.stringify(output.text)};`,
          loader: 'js',
          watchFiles: Object.keys(result.metafile.inputs).map((input) => path.resolve(input)),
        };
      });
    },
  };
}
