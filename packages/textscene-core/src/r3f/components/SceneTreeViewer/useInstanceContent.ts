/**
 * The loaded scenes and GLB below a tree row, in the form `liveChildGroups` reads. The row's own
 * sub-scene comes first. A sub-scene root that instances in turn, such as a GLB, stays the merged
 * node's instance, so what it instances loads too. Each cache answers for the paths it holds only,
 * which keeps every mount's scope to itself (ADR-0009).
 */
import { useMemo } from 'react';
import type { SceneScope, TscnNode } from '../../../parser/types.js';
import { glbPathOf, loneGlbRootPath } from '../../../resources/glbSceneRoot.js';
import { liveInstancePath, scopeOf } from '../../../resources/liveNode.js';
import {
  collapseLiveNode,
  singlePathCache,
  type CachedGlbSource,
  type CachedSceneSource,
} from '../../liveSceneTree.js';
import { useGlbCache } from './useGlbCache.js';
import { useSubSceneChildren } from './useSubSceneChildren.js';

interface InstanceContent {
  sceneCache: CachedSceneSource;
  glbCache: CachedGlbSource | undefined;
}

export function useInstanceContent(node: TscnNode, scope: SceneScope): InstanceContent {
  const scenePath = liveInstancePath(node, scope);
  const subScene = useSubSceneChildren(node.instance, scope.externalResources, scenePath);
  const merged = useMemo(
    () => collapseLiveNode(node, scope, singlePathCache(scenePath, subScene)),
    [node, scope, scenePath, subScene]
  );
  const isMerged = merged !== node;
  const mergedScope = scopeOf(merged, scope);
  const mergedScenePath = isMerged ? liveInstancePath(merged, scope) : null;
  // No ref for a row that did not merge, so no second load.
  const instancedByMerged = useSubSceneChildren(
    isMerged ? merged.instance : undefined,
    mergedScope.externalResources,
    mergedScenePath
  );
  const contentScene = isMerged ? instancedByMerged : subScene;
  // A GLB row's own GLB, else the GLB the row's instance, or the instance its merge leaves, is made of.
  const glbCache = useGlbCache(
    glbPathOf(node) ?? (contentScene ? loneGlbRootPath(contentScene.nodes) : undefined)
  );
  const sceneCache = useMemo<CachedSceneSource>(
    () => ({
      getCached: (path) => {
        if (path === scenePath) return subScene ?? undefined;
        return path === mergedScenePath ? (instancedByMerged ?? undefined) : undefined;
      },
    }),
    [scenePath, subScene, mergedScenePath, instancedByMerged]
  );
  return { sceneCache, glbCache };
}
