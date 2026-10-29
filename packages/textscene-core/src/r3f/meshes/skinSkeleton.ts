/**
 * The THREE.Skeleton a scene Skeleton3D's skin gives a mesh. A skinned mesh draws detached from its
 * skeleton, so each bone carries the skin matrix of its bind in its world matrix, in mesh space,
 * and an identity inverse: three then skins a vertex by the weighted sum of those matrices, as
 * `skeleton.glsl:248-291` does. An AnimationPlayer that writes bone poses to the Skeleton3D moves
 * the skin in place, through the matrices of the bones, and builds nothing again.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Transform3D } from '../../godot/math/transform3d.js';
import type { BoundSkin } from '../../nodes/3d/skeleton3d/skeletonBindings.js';
import type { AnimatedPose } from '../../nodes/3d/skeleton3d/skeletonPose.js';
import { useAnimatedBonePoses } from '../contexts/AnimatedBonePosesContext.js';
import { setMatrixFromTransform3D } from '../nodeTreeTransforms.js';
import { sameData } from '../../utils/sameData.js';
import { useByValue } from '../hooks/useByValue.js';
import { useDisposeOnRelease } from '../useDisposeOnRelease.js';

/**
 * A bone of a skin with no bind at all. The bone buffer Godot allocates for it stays zero
 * (`mesh_storage.cpp:2358`), and a zero matrix collapses the vertex.
 */
const MISSING_BONE_MATRIX = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

/** How many bones the geometry's skin indices address: the highest index, plus one. */
function boneCountOf(geometry: THREE.BufferGeometry): number {
  const indices = geometry.getAttribute('skinIndex');
  let highest = -1;
  for (let i = 0; i < indices.array.length; i++) highest = Math.max(highest, indices.array[i]!);
  return highest + 1;
}

/**
 * How many bones each surface of the geometry addresses: the highest skin index of the vertices the
 * surface draws, plus one, as `_surface_set_data` counts them (`rendering_server.cpp:925`).
 */
function boneCountsOfSurfaces(geometry: THREE.BufferGeometry): number[] {
  const indices = geometry.getAttribute('skinIndex');
  const triangles = geometry.getIndex();
  const surfaces = geometry.groups.length
    ? geometry.groups
    : [{ start: 0, count: triangles?.count ?? geometry.getAttribute('position').count }];
  return surfaces.map(({ start, count }) => {
    let highest = -1;
    for (let slot = start; slot < start + count; slot++) {
      const vertex = triangles ? triangles.getX(slot) : slot;
      for (let k = 0; k < indices.itemSize; k++) highest = Math.max(highest, indices.getComponent(vertex, k));
    }
    return highest + 1;
  });
}

/**
 * Whether Godot draws nothing of the mesh: every surface addresses more bones than the skin binds.
 * `mesh_get_aabb` skips such a surface (`mesh_storage.cpp:729-730`), so an instance whose surfaces
 * are all skipped has no bounds, and `_update_instance` never places it (`renderer_scene_cull.cpp:1679`).
 * A skin with no bind keeps the mesh's own bounds (`mesh_storage.cpp:716`), and its vertices collapse.
 */
export function isOutgrownBySkin(geometry: THREE.BufferGeometry | undefined, bindCount: number): boolean {
  if (!geometry?.getAttribute('skinIndex') || bindCount === 0) return false;
  return boneCountsOfSurfaces(geometry).every((boneCount) => boneCount > bindCount);
}

function writeBoneMatrix(target: THREE.Matrix4, skinMatrix: Transform3D | undefined): void {
  if (skinMatrix) setMatrixFromTransform3D(target, skinMatrix);
  else target.copy(MISSING_BONE_MATRIX);
}

function boneOf(skinMatrix: Transform3D | undefined): THREE.Bone {
  const bone = new THREE.Bone();
  // Never in a scene graph, so nothing recomputes the world matrix written here.
  bone.matrixAutoUpdate = false;
  bone.matrixWorldAutoUpdate = false;
  writeBoneMatrix(bone.matrixWorld, skinMatrix);
  return bone;
}

/**
 * A skeleton whose bones move only when `writeSkin` says so: `update` leaves them, so the renderer
 * neither multiplies every bone nor uploads the bone texture again each frame.
 */
class SkinSkeleton extends THREE.Skeleton {
  constructor(bones: THREE.Bone[]) {
    super(
      bones,
      bones.map(() => new THREE.Matrix4())
    );
    super.update();
  }

  override update(): void {}

  /** Moves each bone to its matrix of `skinMatrices` and fills the bone matrices from them, in place. */
  writeSkin(skinMatrices: readonly Transform3D[]): void {
    this.bones.forEach((bone, i) => writeBoneMatrix(bone.matrixWorld, skinMatrices[i]));
    super.update();
  }
}

function sameMatrices(a: readonly Transform3D[] | undefined, b: readonly Transform3D[] | undefined): boolean {
  return sameData(a, b);
}

/**
 * The skeleton of the `skin` of a Skeleton3D for the skinned `geometry`, or null for a geometry with
 * no bone arrays or a node that binds no skeleton. It takes the bone poses that an AnimationPlayer
 * writes to the Skeleton3D, and the file pose again once they are released. Disposed once nothing
 * draws it.
 *
 * @canonical The THREE.Skeleton a scene Skeleton3D gives a mesh
 */
export function useSkinSkeleton(
  geometry: THREE.BufferGeometry | undefined,
  skin: BoundSkin | undefined
): THREE.Skeleton | null {
  // By value, so a re-parse that builds the same skin again does not rebuild the skeleton.
  const stableMatrices = useByValue(skin?.matrices, sameMatrices);
  const skeleton = useMemo(() => {
    if (!geometry?.getAttribute('skinIndex') || !stableMatrices) return null;
    const bones = Array.from({ length: boneCountOf(geometry) }, (_unused, i) => boneOf(stableMatrices[i]));
    return new SkinSkeleton(bones);
  }, [geometry, stableMatrices]);
  useDisposeOnRelease(skeleton);
  useAnimatedPose(skeleton, skin);
  return skeleton;
}

/**
 * Follows the poses written to the Skeleton3D of `skin`, starting on the ones already written, and
 * writes the file pose back where they are released.
 */
function useAnimatedPose(skeleton: SkinSkeleton | null, skin: BoundSkin | undefined): void {
  const poses = useAnimatedBonePoses();
  useEffect(() => {
    if (!skeleton || !skin) return;
    const follow = (pose: AnimatedPose | null) =>
      skeleton.writeSkin(pose ? skin.matricesUnder(pose) : skin.matrices);
    return poses.subscribe(skin.skeletonPath, follow);
  }, [skeleton, skin, poses]);
}
