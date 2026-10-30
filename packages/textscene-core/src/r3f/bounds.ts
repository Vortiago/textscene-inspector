/**
 * `computeWorldBoundingBox`, the subtree world-space AABB that replaces
 * `THREE.Box3.setFromObject`. That prefers `SkinnedMesh.boundingBox`, a posed box
 * that a cloned GLTF skinned mesh holds far from the origin. Godot's editor also
 * selects by the mesh AABB, not the live pose.
 */
import * as THREE from 'three';
import { godotMatrixWorld } from '../resources/formats/glb/skinnedMeshSpace';
import { isNodeIcon } from './editorHelpers';

const _box = /*@__PURE__*/ new THREE.Box3();
const _matrix = /*@__PURE__*/ new THREE.Matrix4();

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
 * matrices. Returns an empty box when no descendant has geometry. A node icon adds nothing: its size
 * follows the camera, so it has no place in the scene.
 */
export function computeWorldBoundingBox(
  object: THREE.Object3D,
  target: THREE.Box3 = new THREE.Box3(),
  /** A descendant whose whole subtree is left out, such as another item's geometry. */
  skipsSubtree?: (descendant: THREE.Object3D) => boolean
): THREE.Box3 {
  target.makeEmpty();
  object.updateWorldMatrix(true, true);
  unionSubtree(object, target, skipsSubtree);
  return target;
}

function unionSubtree(
  object: THREE.Object3D,
  target: THREE.Box3,
  skipsSubtree: ((descendant: THREE.Object3D) => boolean) | undefined
): void {
  unionOwnBox(object, target);
  for (const child of object.children) {
    if (!skipsSubtree?.(child)) unionSubtree(child, target, skipsSubtree);
  }
}

function unionOwnBox(object: THREE.Object3D, target: THREE.Box3): void {
  const bearing = object as BoundsBearing;
  const geometry = bearing.geometry;
  if (!geometry || isNodeIcon(object)) return;

  // An InstancedMesh or BatchedMesh box unions every instance matrix and is not
  // posed. Without it a GridMap frames one tile. Any other mesh uses the
  // bind-pose `geometry.boundingBox`.
  const src = bearing.isInstancedMesh || bearing.isBatchedMesh ? bearing : geometry;
  if (src.boundingBox === null) src.computeBoundingBox?.();
  if (!src.boundingBox) return;
  _box.copy(src.boundingBox).applyMatrix4(godotMatrixWorld(object, _matrix));
  target.union(_box);
}
