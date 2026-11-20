import process from 'node:process';
import { TEXTURE_WORKER_MODULE, buildWorkerSource, workerSourceModule } from './buildWorkerSource.mjs';

export { TEXTURE_WORKER_MODULE };

const NAMESPACE = 'texture-worker-source';

/**
 * @param {{ minify: boolean, onMetafile: (metafile: import('esbuild').Metafile) => void }} options - `onMetafile`
 *   receives the worker bundle's metafile, whose inputs the outer build's own metafile does not list.
 * @returns {import('esbuild').Plugin}
 */
export function textureWorkerPlugin({ minify, onMetafile }) {
  return {
    name: 'texture-worker-source',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${TEXTURE_WORKER_MODULE}$`) }, (args) => ({
        path: args.path,
        namespace: NAMESPACE,
      }));
      const workingDir = build.initialOptions.absWorkingDir ?? process.cwd();
      build.onLoad({ filter: /.*/, namespace: NAMESPACE }, async () => {
        const { text, metafile, inputFiles } = await buildWorkerSource({ workingDir, minify });
        onMetafile(metafile);
        return { contents: workerSourceModule(text), loader: 'js', watchFiles: inputFiles };
      });
    },
  };
}
