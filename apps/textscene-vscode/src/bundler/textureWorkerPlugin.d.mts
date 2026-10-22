import type { Metafile, Plugin } from 'esbuild';

export const TEXTURE_WORKER_MODULE: 'virtual:texture-worker-source';
export function textureWorkerPlugin(options: {
  minify: boolean;
  onMetafile: (metafile: Metafile) => void;
}): Plugin;
