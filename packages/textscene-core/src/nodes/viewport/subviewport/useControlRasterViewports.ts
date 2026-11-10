/**
 * The reactive half of `collectControlRasterViewports`: re-walks the scene on every
 * live-tree tick, as `useViewportContent` and `useBuildSolveTree` do, since an
 * instanced sub-scene lands after the parse and may hold a Control-only sub-viewport.
 */
import { useMemo } from 'react';

import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { useLayoutDirectionEnv } from '../../../r3f/contexts/useLayoutDirectionEnv.js';
import {
  useLiveTreeVersion,
  useProjectEmbedsSubwindows,
  useProjectPhysicsClock,
} from '../../../r3f/useLiveSceneTree.js';
import { collectControlRasterViewports, type ControlRasterViewport } from './controlRasterViewports.js';
import { NOTHING_CACHED } from '../../../r3f/cacheSources.js';

export function useControlRasterViewports(
  nodes: readonly TscnNode[],
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): readonly ControlRasterViewport[] {
  const loader = useResourceLoader();
  const liveTreeVersion = useLiveTreeVersion(loader);
  // The env `useBuildSolveTree` resolves its Controls against, so the direction handed to a
  // sub-viewport and its Controls' come from one source.
  const layoutDirectionEnv = useLayoutDirectionEnv();
  const physicsClock = useProjectPhysicsClock();
  const rootEmbeds = useProjectEmbedsSubwindows();

  return useMemo(
    () =>
      collectControlRasterViewports(
        nodes,
        // No loader is mounted on first paint or in an isolated test.
        { sceneCache: loader?.scenes ?? NOTHING_CACHED, physicsClock },
        { internalResources, externalResources },
        layoutDirectionEnv,
        rootEmbeds
      ),
    // `liveTreeVersion` is an intentional cache-buster: it ticks when a
    // sub-scene finishes loading, which is when the walk can find more.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      nodes,
      internalResources,
      externalResources,
      loader,
      physicsClock,
      layoutDirectionEnv,
      rootEmbeds,
      liveTreeVersion,
    ]
  );
}
