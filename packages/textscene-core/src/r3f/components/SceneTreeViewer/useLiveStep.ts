/**
 * The step of a tree row, with the scenes and GLB it reads requested. The row's own sub-scene loads
 * first. A sub-scene root that instances in turn, such as a GLB, stays the merged node's instance, so
 * what it instances loads too. The step is the live tree's, so the row re-renders only for a load
 * that changes it.
 */
import type { SceneScope, TscnNode } from '../../../parser/types.js';
import { glbPathOf, loneGlbRootPath } from '../../../resources/glbSceneRoot.js';
import { liveInstancePath } from '../../../resources/liveNode.js';
import { useGlb } from '../../../resources/useGlb.js';
import type { LiveStep } from '../../liveSceneTree.js';
import { useLiveStepOf } from '../../useLiveSceneTree.js';
import { useSubSceneChildren } from './useSubSceneChildren.js';

export function useLiveStep(node: TscnNode, scope: SceneScope): LiveStep {
  const scenePath = liveInstancePath(node, scope);
  const subScene = useSubSceneChildren(node.instance, scope.externalResources, scenePath);
  const step = useLiveStepOf(node, scope);

  // The merge is known from the step, so the GLB a merged root instances loads without a second merge.
  const merged = step.isMerged ? step.node : undefined;
  const mergedScenePath = merged ? liveInstancePath(merged, step.scope) : null;
  const instancedByMerged = useSubSceneChildren(
    merged?.instance,
    step.scope.externalResources,
    mergedScenePath
  );
  const contentScene = merged ? instancedByMerged : subScene;
  // A GLB row's own GLB, else the GLB the row's instance, or the instance its merge leaves, is made of.
  useGlb(glbPathOf(node) ?? (contentScene ? loneGlbRootPath(contentScene.nodes) : undefined));

  return step;
}
