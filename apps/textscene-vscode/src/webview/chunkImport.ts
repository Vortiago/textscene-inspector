/**
 * Loads the webview's code-split chunks. The webview build rewrites every chunk `import()` into
 * a call of this importer (src/bundler/chunkImportPlugin.mjs), so a chunk that VS Code's
 * resource loader cut short loads once more instead of failing its pane.
 */

import { warn } from '@textscene/core/logger';
import { dropCachedResource } from './dropCachedResource';

/** The global the rewritten chunk imports call. */
export const CHUNK_IMPORTER = '__textsceneImportChunk';

/** Written only by `setChunkFailureReporter`. Unset, a chunk that fails twice only rejects. */
let reportChunkFailure: ((error: string) => void) | undefined;

/** Names who hears of a chunk that failed at both URLs, which only a new document can load. */
export function setChunkFailureReporter(report: (error: string) => void): void {
  reportChunkFailure = report;
}

/**
 * Imports the chunk `specifier` names relative to `base`, the importing module's URL. A browser
 * keeps a failed import failed for its URL, so the second try adds a query, which VS Code's
 * resource loader ignores. The query does not reach the chunks it imports, so a cut one of
 * those fails again: that failure goes to the reporter, and rejects for the pane's error boundary.
 * Both copies leave VS Code's resource cache first, so the new document the host loads reads the file.
 */
export async function importChunk(specifier: string, base: string): Promise<unknown> {
  const url = new URL(specifier, base).href;
  try {
    return await import(/* @vite-ignore */ url);
  } catch (error) {
    warn(`A preview chunk failed to load: ${url}: ${String(error)}. It loads again.`);
  }
  try {
    return await import(/* @vite-ignore */ `${url}?reload=1`);
  } catch (error) {
    await Promise.all([dropCachedResource(url), dropCachedResource(`${url}?reload=1`)]);
    reportChunkFailure?.(String(error));
    throw error;
  }
}

(globalThis as Record<string, unknown>)[CHUNK_IMPORTER] = importChunk;
