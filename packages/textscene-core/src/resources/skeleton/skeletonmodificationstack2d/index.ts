/**
 * SkeletonModificationStack2D resource slice, Godot-text kind (ADR-0031). It decodes a stack with
 * the modifications it holds to plain data, so there is no `build.ts`: a Skeleton2D runs the stack
 * on its bones. A stack arrives as a scene sub-resource or as the shared `.tres` container, so the
 * slice claims the type names only.
 */

import { registerResourceSlice } from '../../sliceRegistration';

registerResourceSlice({
  slice: 'skeletonmodificationstack2d',
  kind: 'godot-text',
  typeNames: [
    'SkeletonModificationStack2D',
    'SkeletonModification2DLookAt',
    'SkeletonModification2DTwoBoneIK',
    'SkeletonModification2DCCDIK',
    'SkeletonModification2DFABRIK',
    'SkeletonModification2DStackHolder',
    'SkeletonModification2DJiggle',
    'SkeletonModification2DPhysicalBones',
  ],
  busType: 'resource',
});

export { decodeModificationStack, modificationStackFiles } from './decode';
