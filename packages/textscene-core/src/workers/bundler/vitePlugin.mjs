import process from 'node:process';
import { TEXTURE_WORKER_MODULE, buildWorkerSource, workerSourceModule } from './buildWorkerSource.mjs';

// The `\0` prefix is Rollup's mark for a virtual module, which no other plugin tries to load.
const RESOLVED_ID = `\0${TEXTURE_WORKER_MODULE}`;

/** @returns {import('vite').Plugin} */
export function textureWorkerSource() {
  let minify = false;
  return {
    name: 'texture-worker-source',
    configResolved(config) {
      minify = config.command === 'build';
    },
    resolveId: (id) => (id === TEXTURE_WORKER_MODULE ? RESOLVED_ID : undefined),
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const { text, inputFiles } = await buildWorkerSource({ workingDir: process.cwd(), minify });
      for (const file of inputFiles) this.addWatchFile(file);
      return workerSourceModule(text);
    },
  };
}
