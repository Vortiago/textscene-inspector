/**
 * Owns the full corpus-root-switch sequence for the web previewer:
 * - routes the provider's res:// lookups into the right subtree
 * - installs the THREE LoadingManager URL modifier for text-glTF dependencies
 * - clears the loader caches when the root changes (two corpora sharing a
 *   res:// path must not serve stale bytes from the previous one)
 *
 * The switch is an EXPLICIT scene-swap step, not state derived from the
 * selected fixture. A root change must land only in the gap between the
 * outgoing scene's teardown and the incoming scene's first render:
 * `clearCaches` announces every dropped path, and a mounted `useResource`
 * consumer answers that announcement by re-requesting — so a root that flips
 * while the previous corpus's scene is still mounted makes that scene fetch
 * its own res:// paths out of the INCOMING corpus, downloading files that
 * belong to an unrelated fixture. Callers therefore tear the current scene
 * down first and call `applyCorpusRoot` at the moment they swap in the new
 * scene's content (`useSceneSource`'s `onBeforeSwap`, the upload handler).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { ResourcePipeline } from '@textscene/core';
import type { WebResourceProvider } from './providers/WebResourceProvider';
import { fixtureUrlForGltfUri } from './corpusRoot';

/**
 * Route the provider's res:// lookups into the subtree and point the THREE
 * LoadingManager URL modifier at it. The cache clear stays with
 * {@link useCorpusRoot}, which knows whether the root actually CHANGED —
 * never call this on its own, which would leave the caches holding the
 * corpus being left behind.
 */
export function switchCorpusRoot(
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
 * Returns `applyCorpusRoot(root)` — the idempotent switch: routing plus a
 * cache clear on an actual change. Installs the base ('') routing on mount so
 * the URL modifier is live before anything renders.
 */
export function useCorpusRoot(
  pipeline: ResourcePipeline<WebResourceProvider>
): (root: string) => void {
  // Both halves of "have we already applied this?" — a fresh pipeline needs
  // re-routing even at an unchanged root, and only a root CHANGE clears.
  const appliedRef = useRef<{
    pipeline: ResourcePipeline<WebResourceProvider>;
    root: string;
  } | null>(null);

  const applyCorpusRoot = useCallback(
    (root: string) => {
      const applied = appliedRef.current;
      if (applied?.pipeline === pipeline && applied.root === root) return;
      switchCorpusRoot(pipeline, root);
      if (applied && applied.root !== root) pipeline.loader.clearCaches();
      appliedRef.current = { pipeline, root };
    },
    [pipeline]
  );

  // Base ('') routing from the start, so the URL modifier is live before
  // anything renders. Deliberately NOT an `applyCorpusRoot` call: nothing has
  // been loaded yet, so the first real scene swap must route without paying a
  // cache clear.
  useEffect(() => {
    switchCorpusRoot(pipeline, '');
  }, [pipeline]);

  return applyCorpusRoot;
}
