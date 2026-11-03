/**
 * `computeWorldBoundingBox`, the subtree world-space AABB that replaces
 * `THREE.Box3.setFromObject`. That prefers `SkinnedMesh.boundingBox`, a posed box
 * that a cloned GLTF skinned mesh holds far from the origin. Godot's editor also
 * selects by the mesh AABB, not the live pose.
 */
import * as THREE from 'three';
import { godotMatrixWorld } from '../resources/formats/glb/skinnedMeshSpace';
import { hasSurface, type Aabb } from '../godot/math/aabb';
import { isEditorHelper, isNodeIcon } from './editorHelpers';

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
 * Union of every descendant's world-space box, after a refresh of the world matrices: the drawn
 * geometry and the explicit AABB of a node ({@link godotAabbUserData}). Returns an empty box when
 * there is none. Editor chrome adds nothing, as the selection box of Godot unions `get_aabb` alone
 * (`node_3d_editor_plugin.cpp:5029-5065`). A node icon adds nothing either: its size follows the
 * camera, so it has no place in the scene.
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
    if (!isEditorHelper(child) && !skipsSubtree?.(child)) unionSubtree(child, target, skipsSubtree);
  }
}

/** Where an object records that its node gives the editor no box of its own. */
const BOXLESS_KEY = 'godotBoxless';

/**
 * The userData of a draw whose node's `get_aabb` is `AABB()`, as a CPUParticles3D's is
 * (`cpu_particles_3d.cpp:43-45`): the selection box and the framing leave it out. On each draw, not
 * a group: the framing measures each drawable object on its own.
 */
export function boxlessUserData(): { godotBoxless: true } {
  return { [BOXLESS_KEY]: true };
}

const AABB_KEY = 'godotAabb';

/**
 * The userData of an object that stands for the `get_aabb` of its node, in the node's space. A node
 * with a box and no drawn geometry of that size, such as a Decal, mounts it.
 */
export function godotAabbUserData(aabb: Aabb): { godotAabb: Aabb } {
  return { [AABB_KEY]: aabb };
}

function unionExplicitBox(object: THREE.Object3D, aabb: Aabb, target: THREE.Box3): void {
  if (!hasSurface(aabb.size)) return;
  const { position, size } = aabb;
  _box.min.set(position.x, position.y, position.z);
  _box.max.set(position.x + size.x, position.y + size.y, position.z + size.z);
  target.union(_box.applyMatrix4(object.matrixWorld));
}

function unionOwnBox(object: THREE.Object3D, target: THREE.Box3): void {
  const explicit = object.userData[AABB_KEY] as Aabb | undefined;
  if (explicit) return unionExplicitBox(object, explicit, target);
  const bearing = object as BoundsBearing;
  const geometry = bearing.geometry;
  if (!geometry || isNodeIcon(object) || object.userData[BOXLESS_KEY] === true) return;

  // An instanced draw's own box unions every instance and is not posed: an InstancedMesh, a
  // BatchedMesh, or points over an instanced geometry (`instancesBounds`). Without it a GridMap
  // frames one tile. Any other mesh uses the bind-pose `geometry.boundingBox`.
  const isInstanced =
    bearing.isInstancedMesh ||
    bearing.isBatchedMesh ||
    (geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry;
  const src = isInstanced ? bearing : geometry;
  if (src.boundingBox === null) src.computeBoundingBox?.();
  if (!src.boundingBox) return;
  _box.copy(src.boundingBox).applyMatrix4(godotMatrixWorld(object, _matrix));
  target.union(_box);
}
