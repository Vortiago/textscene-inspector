/**
 * The reactive half of content classification: `viewportContentKind` over the
 * resolved subtree, re-derived on each live-tree tick. The kind picks which
 * publisher owns the registry key, so a change renders normally and each
 * publisher's effects tear down and re-register in order.
 */

import { useMemo } from 'react';

import type { TscnNode } from '../../../parser/types.js';
import { useSceneResources } from '../../../r3f/SceneResourcesContext.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { useLiveTreeVersion } from '../../../r3f/useLiveSceneTree.js';
import {
  resolveStandaloneViewportSubtree,
  viewportContent,
  type ViewportContent,
  type ViewportContentKind,
} from './viewportContent.js';
import { NOTHING_CACHED } from '../../../r3f/cacheSources.js';

export function useViewportContent(node: TscnNode): ViewportContent {
  // The sub-viewport's children resolve their instance refs against the scene
  // the sub-viewport lives in, the scope in force here.
  const { externalResources } = useSceneResources();
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(loader);
  // No loader is mounted in the linter bundle or an isolated test.
  const sceneCache = loader?.scenes ?? NOTHING_CACHED;

  return useMemo(
    () => viewportContent(resolveStandaloneViewportSubtree(node, externalResources, sceneCache)),
    // `version` is an intentional cache-buster: it increments each time a
    // sub-scene finishes loading, which is when an instance child stops being
    // typeless. The value itself is not read in the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node, externalResources, sceneCache, version]
  );
}

export function useViewportContentKind(node: TscnNode): ViewportContentKind {
  return useViewportContent(node).kind;
}
