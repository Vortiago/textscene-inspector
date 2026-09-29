import type { Plugin } from 'esbuild';

export const TEXTURE_WORKER_MODULE: 'virtual:texture-worker-source';
export function textureWorkerPlugin(options: { minify: boolean }): Plugin;
