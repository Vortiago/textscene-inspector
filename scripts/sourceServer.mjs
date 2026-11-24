import { createServer } from 'vite';
import { REPO_ROOT } from './repoRoot.mjs';

/**
 * `ssrLoadModule` loads a source file by its repository path. The caller closes it.
 *
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
