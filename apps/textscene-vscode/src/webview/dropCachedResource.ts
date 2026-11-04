/**
 * Drops a resource from VS Code's webview resource cache. The webview service worker stores each
 * file it serves, and a transfer that ended early is stored cut. While the file's ETag holds, the
 * worker answers every later request from that copy, so a new document loads the cut copy again.
 * Once the entry is dropped, the next request reads the file.
 */

/** The prefix of the cache's name (`resourceCacheName` in VS Code's `pre/service-worker.js`). */
export const RESOURCE_CACHE_PREFIX = 'vscode-resource-cache-';

export async function dropCachedResource(url: string): Promise<void> {
  try {
    for (const name of await caches.keys()) {
      if (name.startsWith(RESOURCE_CACHE_PREFIX)) await (await caches.open(name)).delete(url);
    }
  } catch {
    // Without the Cache API the reload loads as it did before.
  }
}
