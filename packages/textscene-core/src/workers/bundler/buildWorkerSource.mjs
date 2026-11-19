import path from 'node:path';
import * as esbuild from 'esbuild';

export const TEXTURE_WORKER_MODULE = 'virtual:texture-worker-source';

const WORKER_SCRIPT = path.resolve(import.meta.dirname, '../workerScript.ts');

/**
 * @param {{ workingDir: string, minify: boolean }} options - `workingDir` is the outer build's, so the
 *   worker's metafile inputs merge with its own.
 * @returns {Promise<{ text: string, metafile: esbuild.Metafile, inputFiles: string[] }>} the script, its
 *   metafile, and the absolute path of each file it holds, for a bundler's watch list.
 */
export async function buildWorkerSource({ workingDir, minify }) {
  const result = await esbuild.build({
    absWorkingDir: workingDir,
    entryPoints: [WORKER_SCRIPT],
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
  if (!output) throw new Error(`expected one worker bundle from ${WORKER_SCRIPT}, got none`);
  const inputFiles = Object.keys(result.metafile.inputs).map((input) => path.resolve(workingDir, input));
  return { text: output.text, metafile: result.metafile, inputFiles };
}

/** The module text a bundler serves for `virtual:texture-worker-source`. */
export function workerSourceModule(text) {
  return `export default ${JSON.stringify(text)};`;
}
