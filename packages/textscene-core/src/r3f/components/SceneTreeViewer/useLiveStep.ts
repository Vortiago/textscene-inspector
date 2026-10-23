/**
 * The step of a tree row, as `liveStep` returns it, with the scenes and GLB it reads
 * loaded. The row's own sub-scene loads first. A sub-scene root that instances in turn, such as a
 * GLB, stays the merged node's instance, so what it instances loads too. Each cache answers for the
 * paths it holds only, which keeps every mount's scope to itself (ADR-0009). The row re-renders as
 * each load arrives.
 */
import { useMemo } from 'react';
import type { SceneScope, TscnNode } from '../../../parser/types.js';
import { glbPathOf, loneGlbRootPath } from '../../../resources/glbSceneRoot.js';
import { liveInstancePath } from '../../../resources/liveNode.js';
import { liveStep, singlePathCache, type CachedSceneSource, type LiveStep } from '../../liveSceneTree.js';
import { useGlbCache } from './useGlbCache.js';
import { useSubSceneChildren } from './useSubSceneChildren.js';

export function useLiveStep(node: TscnNode, scope: SceneScope): LiveStep {
  const scenePath = liveInstancePath(node, scope);
  const subScene = useSubSceneChildren(node.instance, scope.externalResources, scenePath);
  const withoutGlb = useMemo(
    () => liveStep(node, scope, singlePathCache(scenePath, subScene)),
    [node, scope, scenePath, subScene]
  );

  // The merge is known from the step, which shows another node than the row's own once the instance
  // collapses, so the GLB a merged root instances loads without a second merge.
  const merged = withoutGlb.node === node ? undefined : withoutGlb.node;
  const mergedScenePath = merged ? liveInstancePath(merged, withoutGlb.scope) : null;
  const instancedByMerged = useSubSceneChildren(
    merged?.instance,
    withoutGlb.scope.externalResources,
    mergedScenePath
  );
  const contentScene = merged ? instancedByMerged : subScene;
  // A GLB row's own GLB, else the GLB the row's instance, or the instance its merge leaves, is made of.
  const glbCache = useGlbCache(
    glbPathOf(node) ?? (contentScene ? loneGlbRootPath(contentScene.nodes) : undefined)
  );

  return useMemo(() => {
    if (!glbCache) return withoutGlb;
    const sceneCache: CachedSceneSource = {
      getCached: (path) => {
        if (path === scenePath) return subScene ?? undefined;
        return path === mergedScenePath ? (instancedByMerged ?? undefined) : undefined;
      },
    };
    return liveStep(node, scope, sceneCache, glbCache);
  }, [glbCache, withoutGlb, node, scope, scenePath, subScene, mergedScenePath, instancedByMerged]);
}
