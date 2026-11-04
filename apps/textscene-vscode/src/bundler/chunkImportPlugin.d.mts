import type { Plugin } from 'esbuild';

export const CHUNK_IMPORTER: '__textsceneImportChunk';
export function rewriteChunkImports(code: string, chunkSpecifiers: string[]): string;
export function chunkImportPlugin(): Plugin;
