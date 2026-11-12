/**
 * The modification stack of a Skeleton2D as its pose runs it: the decoded stack, which re-decodes
 * as each file it names loads, and the node each of its NodePaths names on the Live scene tree,
 * with its place in the rig of the skeleton.
 */

import { useCallback, useMemo } from 'react';
import { liveScenePassResults } from '../../../r3f/liveScenePass.js';
import { liveTreeOf } from '../../../r3f/liveSceneTree.js';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useLiveTreeSelection, type SharedLiveTree } from '../../../r3f/useLiveSceneTree.js';
import {
  decodeModificationStack,
  modificationStackFiles,
} from '../../../resources/skeleton/skeletonmodificationstack2d/index.js';
import type { LoadedFile } from '../../../resources/scopedResource';
import { useLoadedFiles } from '../../../resources/useLoadedFiles';
import { sameData } from '../../../utils/sameData.js';
import { stackNodePaths } from './modificationStack/stackPaths.js';
import type { BoundStack, StackTarget } from './skeletonPose.js';
import { bindSkeleton2DRigs } from './skeletonRig.js';
import { stackTargets } from './stackTargets.js';

type Targets = ReadonlyMap<string, StackTarget>;

function sameTargets(a: Targets, b: Targets): boolean {
  return sameData([...a], [...b]);
}

/**
 * The stack `ref` names, bound to the nodes its paths reach from the skeleton at `skeletonPath`.
 * Null for no stack, a stack still loading, or no path.
 */
export function useBoundStack(ref: string | undefined, skeletonPath: string | null): BoundStack | null {
  const pools = useSceneResources();
  const plan = useCallback(
    (loadedFile: LoadedFile) => modificationStackFiles(ref, pools, loadedFile),
    [ref, pools]
  );
  const { loadedFile } = useLoadedFiles(plan);
  const stack = useMemo(() => decodeModificationStack(ref, pools, loadedFile), [ref, pools, loadedFile]);
  const select = useMemo(() => {
    if (!stack || skeletonPath === null) return null;
    const literals = stackNodePaths(stack);
    return ({ roots, ctx }: SharedLiveTree): Targets => {
      const tree = liveTreeOf(roots, ctx);
      const rigs = liveScenePassResults(bindSkeleton2DRigs, tree);
      return stackTargets(literals, skeletonPath, tree, rigs);
    };
  }, [stack, skeletonPath]);
  const targets = useLiveTreeSelection(select, sameTargets);
  return useMemo(() => (stack && targets ? { stack, targets } : null), [stack, targets]);
}
