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

export function useCorpusRoot(
  pipeline: ResourcePipeline<WebResourceProvider>,
  resourceRoot: string
): void {
  const { provider, loader } = pipeline;
  const lastRootRef = useRef<string | null>(null);

  useEffect(() => {
    provider.setResourceRoot(resourceRoot);
    loader.eventBus.getThreeManager().setURLModifier(
      (url: string) => fixtureUrlForRes(url, resourceRoot)
    );
    if (lastRootRef.current !== null && lastRootRef.current !== resourceRoot) {
      loader.clearCaches();
    }
    lastRootRef.current = resourceRoot;
  }, [resourceRoot, provider, loader]);
}
