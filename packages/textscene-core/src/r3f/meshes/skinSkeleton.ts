/**
 * The THREE.Skeleton a scene Skeleton3D's skin gives a mesh. A skinned mesh draws detached from its
 * skeleton, so each bone carries the skin matrix of its bind in its world matrix, in mesh space,
 * and an identity inverse: three then skins a vertex by the weighted sum of those matrices, as
 * `skeleton.glsl:248-291` does.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Transform3D } from '../../godot/math/transform3d.js';
import { transform3DToMatrix } from '../nodeTreeTransforms.js';
import { useDisposeOnRelease } from '../useDisposeOnRelease.js';

/**
 * A bone beyond the skin's binds. Godot reads such a bone from past the end of the skeleton buffer, so
 * its result depends on the GPU; the lavapipe driver gives zero for a skeleton with no bind, measured
 * with `pnpm ref:godot`. A zero matrix collapses the vertex there, which three needs a bone to draw.
 */
const MISSING_BONE_MATRIX = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

/** How many bones the geometry's skin indices address: the highest index, plus one. */
function boneCountOf(geometry: THREE.BufferGeometry): number {
  const indices = geometry.getAttribute('skinIndex');
  let highest = -1;
  for (let i = 0; i < indices.array.length; i++) highest = Math.max(highest, indices.array[i]!);
  return highest + 1;
}

function boneOf(skinMatrix: Transform3D | undefined): THREE.Bone {
  const bone = new THREE.Bone();
  // Never in a scene graph, so nothing recomputes the world matrix written here.
  bone.matrixAutoUpdate = false;
  bone.matrixWorldAutoUpdate = false;
  bone.matrixWorld.copy(skinMatrix ? transform3DToMatrix(skinMatrix) : MISSING_BONE_MATRIX);
  return bone;
}

/**
 * A skeleton whose bones never move: it fills its bone matrices once, and `update` leaves them, so
 * the renderer neither multiplies every bone nor uploads the bone texture again each frame.
 */
class FrozenSkeleton extends THREE.Skeleton {
  constructor(bones: THREE.Bone[]) {
    super(
      bones,
      bones.map(() => new THREE.Matrix4())
    );
    super.update();
  }

  override update(): void {}
}

/**
 * `matrices` itself while its values are those of the previous call, so a re-parse that writes a
 * new array of the same matrices does not rebuild the skeleton.
 */
function useMatricesByValue(
  matrices: readonly Transform3D[] | undefined
): readonly Transform3D[] | undefined {
  const previous = useRef(matrices);
  if (matrices !== previous.current && JSON.stringify(matrices) !== JSON.stringify(previous.current)) {
    previous.current = matrices;
  }
  return previous.current;
}

/**
 * The skeleton of `skinMatrices` for the skinned `geometry`, or null for a geometry with no bone
 * arrays or a node that binds no skeleton. Disposed once nothing draws it.
 *
 * @canonical The THREE.Skeleton a scene Skeleton3D gives a mesh
 */
export function useSkinSkeleton(
  geometry: THREE.BufferGeometry | undefined,
  skinMatrices: readonly Transform3D[] | undefined
): THREE.Skeleton | null {
  const stableMatrices = useMatricesByValue(skinMatrices);
  const skeleton = useMemo(() => {
    if (!geometry?.getAttribute('skinIndex') || !stableMatrices) return null;
    const bones = Array.from({ length: boneCountOf(geometry) }, (_unused, i) => boneOf(stableMatrices[i]));
    return new FrozenSkeleton(bones);
  }, [geometry, stableMatrices]);
  useDisposeOnRelease(skeleton);
  return skeleton;
}
