/**
 * esbuild plugin: bundles the webview's job worker into one IIFE script and
 * exposes its text as the default export of `virtual:texture-worker-source`.
 * The webview starts the worker from a blob URL of that text, so starting it
 * fetches nothing: the CSP grants `worker-src blob:` and no `connect-src` (ADR-0042).
 */
import path from 'node:path';
import process from 'node:process';
import * as esbuild from 'esbuild';

export const TEXTURE_WORKER_MODULE = 'virtual:texture-worker-source';

const NAMESPACE = 'texture-worker-source';
const WORKER_ENTRY = path.resolve(import.meta.dirname, '../webview/textureWorker.ts');

/**
 * @param {{ minify: boolean, onMetafile: (metafile: esbuild.Metafile) => void }} options - `onMetafile`
 *   receives the worker bundle's metafile, whose inputs the webview's own metafile does not list.
 * @returns {esbuild.Plugin}
 */
export function textureWorkerPlugin({ minify, onMetafile }) {
  return {
    name: 'texture-worker-source',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${TEXTURE_WORKER_MODULE}$`) }, (args) => ({
        path: args.path,
        namespace: NAMESPACE,
      }));
      // The outer build's working directory, so the worker's metafile inputs merge with its own.
      const workingDir = build.initialOptions.absWorkingDir ?? process.cwd();
      build.onLoad({ filter: /.*/, namespace: NAMESPACE }, async () => {
        const result = await esbuild.build({
          absWorkingDir: workingDir,
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
        onMetafile(result.metafile);
        return {
          contents: `export default ${JSON.stringify(output.text)};`,
          loader: 'js',
          watchFiles: Object.keys(result.metafile.inputs).map((input) => path.resolve(workingDir, input)),
        };
      });
    },
  };
}
