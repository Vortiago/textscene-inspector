/**
 * The pose a Sprite3D or a Label3D takes from its own material: Godot's billboard and `fixed_size`
 * are flags of that material (`sprite_3d.cpp:299`, `label_3d.cpp:396`), so `material_override`
 * drops both, and every other draw of the instance stays at the node's pose.
 */

import type { RefObject } from 'react';
import type * as THREE from 'three';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode';
import { useInstanceDraw } from '../visibilityRange/geometryInstance';
import type { Vec3Tuple } from '../nodeTransform';
import { useBillboard } from './useBillboard';
import { useFixedSize } from './useFixedSize';

interface OwnMaterialFlags {
  billboard: number;
  fixed_size: boolean;
}

/**
 * Poses `ref`'s object by `flags` at each frame. Returns `ref` while the flags move it away from
 * the node's pose, for `InstancePasses` to hold the extra draws there, and undefined otherwise.
 */
export function useOwnMaterialPose(
  ref: RefObject<THREE.Object3D | null>,
  flags: OwnMaterialFlags,
  authoredScale: Vec3Tuple
): RefObject<THREE.Object3D | null> | undefined {
  const drawsOwnMaterial = useInstanceDraw().override === undefined;
  const billboard = drawsOwnMaterial ? flags.billboard : BillboardMode.BILLBOARD_DISABLED;
  const isFixedSize = drawsOwnMaterial && flags.fixed_size;
  // Fixed size first: the billboard freezes the world matrix, so a scale set after it lands a frame late.
  useFixedSize(ref, isFixedSize, authoredScale);
  useBillboard(ref, billboard);
  return isFixedSize || billboard !== BillboardMode.BILLBOARD_DISABLED ? ref : undefined;
}
