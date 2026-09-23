/**
 * `computeWorldBoundingBox`, the subtree world-space AABB that replaces
 * `THREE.Box3.setFromObject`. That prefers `SkinnedMesh.boundingBox`, a posed box
 * that a cloned GLTF skinned mesh holds far from the origin. Godot's editor also
 * selects by the mesh AABB, not the live pose.
 */
import * as THREE from 'three';

const _box = /*@__PURE__*/ new THREE.Box3();

/**
 * Object3D that may carry geometry and/or an object-level bounding box
 * (`InstancedMesh` / `BatchedMesh`).
 */
interface BoundsBearing extends THREE.Object3D {
  geometry?: THREE.BufferGeometry;
  isInstancedMesh?: boolean;
  isBatchedMesh?: boolean;
  boundingBox?: THREE.Box3 | null;
  computeBoundingBox?: () => void;
}

/**
 * Union of every descendant's world-space box, after a refresh of the world
 * matrices. Returns an empty box when no descendant has geometry.
 */
export function computeWorldBoundingBox(
  object: THREE.Object3D,
  target: THREE.Box3 = new THREE.Box3()
): THREE.Box3 {
  target.makeEmpty();
  object.updateWorldMatrix(true, true);
  object.traverse((child) => {
    const bearing = child as BoundsBearing;
    const geometry = bearing.geometry;
    if (!geometry) return;

    // An InstancedMesh or BatchedMesh box unions every instance matrix and is not
    // posed. Without it a GridMap frames one tile. Any other mesh uses the
    // bind-pose `geometry.boundingBox`.
    const src = bearing.isInstancedMesh || bearing.isBatchedMesh ? bearing : geometry;
    if (src.boundingBox === null) src.computeBoundingBox?.();
    if (!src.boundingBox) return;
    _box.copy(src.boundingBox).applyMatrix4(child.matrixWorld);
    target.union(_box);
  });
  return target;
}
