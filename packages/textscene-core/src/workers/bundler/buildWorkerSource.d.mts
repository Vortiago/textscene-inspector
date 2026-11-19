import type { Metafile } from 'esbuild';

export const TEXTURE_WORKER_MODULE: 'virtual:texture-worker-source';
export function buildWorkerSource(options: {
  workingDir: string;
  minify: boolean;
}): Promise<{ text: string; metafile: Metafile; inputFiles: string[] }>;
export function workerSourceModule(text: string): string;
