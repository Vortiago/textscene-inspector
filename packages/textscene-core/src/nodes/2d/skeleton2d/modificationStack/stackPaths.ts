/** The NodePaths a SkeletonModificationStack2D names, which its Skeleton2D resolves from itself. */

import type {
  BoneReference,
  Modification2D,
  ModificationStack2D,
} from '../../../../resources/skeleton/skeletonmodificationstack2d/types';

type Path = string | undefined;

function bonePaths(bones: readonly BoneReference[]): Path[] {
  return bones.map((bone) => bone.node);
}

function pathsOf(modification: Modification2D | null): Path[] {
  switch (modification?.type) {
    case 'SkeletonModification2DLookAt':
      return [modification.target, modification.bone.node];
    case 'SkeletonModification2DTwoBoneIK':
      return [modification.target, ...bonePaths([modification.jointOne, modification.jointTwo])];
    case 'SkeletonModification2DCCDIK':
      return [modification.target, modification.tip];
    case 'SkeletonModification2DFABRIK':
      return [modification.target, ...bonePaths(modification.joints.map((joint) => joint.bone))];
    case 'SkeletonModification2DStackHolder':
      return modification.heldStack ? stackNodePaths(modification.heldStack) : [];
    default:
      return [];
  }
}

/**
 * Each NodePath literal a modification of `stack` reads, once, with the stacks it holds. A CCDIK
 * joint reads only its stored index, so its bone path is not one of them.
 */
export function stackNodePaths(stack: ModificationStack2D): string[] {
  const paths = stack.modifications.flatMap(pathsOf).filter((path): path is string => path !== undefined);
  return [...new Set(paths)];
}
