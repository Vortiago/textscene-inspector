/**
 * The corpus-root switch: it routes res:// lookups into a subtree, and clears the loader
 * caches so two corpora never share bytes for one path. A mounted consumer re-requests on
 * `clearCaches`, from the incoming corpus, so callers tear the scene down first and switch at
 * the swap (`onBeforeSwap`, the upload handler).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { ResourcePipeline } from '@textscene/core';
import type { WebResourceProvider } from './providers/WebResourceProvider';

/**
 * Route the provider's res:// lookups into the subtree. Module-private: without the cache
 * clear `applyCorpusRoot` pairs it with, the caches would hold the corpus being left.
 */
function switchCorpusRoot(pipeline: ResourcePipeline<WebResourceProvider>, resourceRoot: string): void {
  pipeline.provider.setResourceRoot(resourceRoot);
}

/**
 * Returns `applyCorpusRoot(root)`, the idempotent switch: routing, and a cache clear on a real
 * change.
 */
export function useCorpusRoot(pipeline: ResourcePipeline<WebResourceProvider>): (root: string) => void {
  // The root of the last swap. Null until the first one, which routes without clearing:
  // nothing has loaded yet to go stale.
  const appliedRootRef = useRef<string | null>(null);

  const applyCorpusRoot = useCallback(
    (root: string) => {
      const applied = appliedRootRef.current;
      if (applied === root) return;
      switchCorpusRoot(pipeline, root);
      if (applied !== null) pipeline.loader.clearCaches();
      appliedRootRef.current = root;
    },
    [pipeline]
  );

  // Base ('') routing on mount, so it is live before anything renders. Not
  // `applyCorpusRoot`, so the first real swap routes without a cache clear.
  useEffect(() => {
    switchCorpusRoot(pipeline, '');
  }, [pipeline]);

  return applyCorpusRoot;
}
