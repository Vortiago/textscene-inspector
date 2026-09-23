/**
 * The corpus-root switch: it routes res:// lookups and the text-glTF URL modifier into a
 * subtree, and clears the loader caches so two corpora never share bytes for one path. A
 * mounted consumer re-requests on `clearCaches`, from the incoming corpus, so callers tear the
 * scene down first and switch at the swap (`onBeforeSwap`, the upload handler).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { ResourcePipeline } from '@textscene/core';
import type { WebResourceProvider } from './providers/WebResourceProvider';
import { fixtureUrlForGltfUri } from './corpusRoot';

/**
 * Route the provider's res:// lookups and the THREE LoadingManager URL modifier into the
 * subtree. Module-private: without the cache clear `applyCorpusRoot` pairs it with, the caches
 * would hold the corpus being left.
 */
function switchCorpusRoot(
  pipeline: ResourcePipeline<WebResourceProvider>,
  resourceRoot: string
): void {
  const { provider, loader } = pipeline;
  provider.setResourceRoot(resourceRoot);
  loader.eventBus.getThreeManager().setURLModifier(
    (url: string) => fixtureUrlForGltfUri(url, resourceRoot)
  );
}

/**
 * Returns `applyCorpusRoot(root)`, the idempotent switch: routing, and a cache clear on a real
 * change.
 */
export function useCorpusRoot(
  pipeline: ResourcePipeline<WebResourceProvider>
): (root: string) => void {
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

  // Base ('') routing on mount, so the URL modifier is live before anything renders. Not
  // `applyCorpusRoot`, so the first real swap routes without a cache clear.
  useEffect(() => {
    switchCorpusRoot(pipeline, '');
  }, [pipeline]);

  return applyCorpusRoot;
}
