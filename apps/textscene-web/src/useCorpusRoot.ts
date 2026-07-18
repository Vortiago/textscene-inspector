/**
 * Owns the full corpus-root-switch sequence for the web previewer:
 * - routes the provider's res:// lookups into the right subtree
 * - installs the THREE LoadingManager URL modifier for text-glTF dependencies
 * - clears the loader caches when the root changes (two corpora sharing a
 *   res:// path must not serve stale bytes from the previous one)
 *
 * Extracted from R3FApp so the three-step invariant lives in one place and
 * can be unit-tested independently of the full app shell.
 */
import { useEffect, useRef } from 'react';
import type { ResourcePipeline } from '@textscene/core';
import type { WebResourceProvider } from './providers/WebResourceProvider';
import { fixtureUrlForRes } from './corpusRoot';

/**
 * Apply the synchronous half of a corpus-root switch: route the provider's
 * res:// lookups into the subtree and point the THREE LoadingManager URL
 * modifier at it. The cache clear stays with `useCorpusRoot`, which knows
 * whether the root actually CHANGED. Callers needing the switch ahead of
 * React's commit (an upload keying companion files under the new corpus)
 * call this directly and let the hook's effect settle the caches — never
 * write `provider.setResourceRoot` on its own, which would leave the URL
 * modifier serving the corpus being left behind.
 */
export function switchCorpusRoot(
  pipeline: ResourcePipeline<WebResourceProvider>,
  resourceRoot: string
): void {
  const { provider, loader } = pipeline;
  provider.setResourceRoot(resourceRoot);
  loader.eventBus.getThreeManager().setURLModifier(
    (url: string) => fixtureUrlForRes(url, resourceRoot)
  );
}

export function useCorpusRoot(
  pipeline: ResourcePipeline<WebResourceProvider>,
  resourceRoot: string
): void {
  const { loader } = pipeline;
  const lastRootRef = useRef<string | null>(null);

  useEffect(() => {
    switchCorpusRoot(pipeline, resourceRoot);
    if (lastRootRef.current !== null && lastRootRef.current !== resourceRoot) {
      loader.clearCaches();
    }
    lastRootRef.current = resourceRoot;
  }, [resourceRoot, pipeline, loader]);
}
