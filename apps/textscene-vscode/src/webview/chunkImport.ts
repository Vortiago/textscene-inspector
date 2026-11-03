/**
 * Loads the webview's code-split chunks. The webview build rewrites every chunk `import()` into
 * a call of this importer (src/bundler/chunkImportPlugin.mjs), so a chunk that VS Code's
 * resource loader cut short loads once more instead of failing its pane (#1147).
 */

import { warn } from '@textscene/core/logger';

/** The global the rewritten chunk imports call. The webview entry imports this module first. */
export const CHUNK_IMPORTER = '__textsceneImportChunk';

/**
 * Imports the chunk `specifier` names relative to `base`, the importing module's URL. A browser
 * keeps a failed import failed for its URL, so the second try adds a query, which VS Code's
 * resource loader ignores. A second failure rejects, for the pane's error boundary.
 */
export async function importChunk(specifier: string, base: string): Promise<unknown> {
  const url = new URL(specifier, base).href;
  try {
    return await import(/* @vite-ignore */ url);
  } catch (error) {
    warn(`A preview chunk failed to load: ${url}: ${String(error)}. It loads again.`);
    return import(/* @vite-ignore */ `${url}?reload=1`);
  }
}

(globalThis as Record<string, unknown>)[CHUNK_IMPORTER] = importChunk;
