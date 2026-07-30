/**
 * The reactive half of content classification: `viewportContentKind` over the
 * RESOLVED subtree, re-derived as sub-scenes land.
 *
 * Kept out of `viewportContent.ts` so the rules there stay pure — the classifier
 * and the resolver are both asserted directly, and only the wiring needs React.
 *
 * The version tick matters more here than in most live-tree readers. Classification
 * decides which rasterizer OWNS a target, and both write the same registry key,
 * so a kind that changed silently mid-load would leave two publishers racing.
 * Re-deriving on the tick means the change happens as a normal render, with the
 * publisher's own effects tearing down and re-registering in order.
 */

import { useMemo } from 'react';

import type { TscnNode } from '../../../parser/types.js';
import type { CachedSceneSource } from '../../../r3f/liveSceneTree.js';
import { useSceneResources } from '../../../r3f/SceneResourcesContext.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { useLiveTreeVersion } from '../../../r3f/useLiveSceneTree.js';
import {
  resolveViewportSubtree,
  viewportContentKind,
  type ViewportContentKind,
} from './viewportContent.js';

/** No loader (the linter bundle, isolated tests): nothing is cached, ever. */
const NO_SCENES: CachedSceneSource = { getCached: () => undefined };

export function useViewportContentKind(node: TscnNode): ViewportContentKind {
  // The sub-viewport's children resolve their instance refs against the scene
  // the SUB-VIEWPORT lives in, which is exactly the scope in force here.
  const { externalResources } = useSceneResources();
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(loader);
  const sceneCache = loader?.scenes ?? NO_SCENES;

  return useMemo(
    () =>
      viewportContentKind(resolveViewportSubtree(node, externalResources, sceneCache)),
    // `version` is an intentional cache-buster: it increments each time a
    // sub-scene finishes loading, which is when an instance child stops being
    // typeless. The value itself is not read in the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node, externalResources, sceneCache, version]
  );
}
