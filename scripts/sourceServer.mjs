import { createServer } from 'vite';
import { REPO_ROOT } from './repoRoot.mjs';

/**
 * A server whose `ssrLoadModule` loads a source file by its path from the repository root. The
 * caller closes it.
 * @canonical Load TypeScript sources into a Node script
 */
export function sourceServer() {
  return createServer({
    root: REPO_ROOT,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
}
