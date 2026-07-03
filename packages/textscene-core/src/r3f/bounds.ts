/**
 * `computeWorldBoundingBox` — the sanctioned subtree world-space AABB, a
 * SkinnedMesh-safe replacement for `THREE.Box3.setFromObject`.
 *
 * For an ordinary mesh it unions each descendant's `geometry.boundingBox`
 * transformed by that descendant's `matrixWorld`. `InstancedMesh` /
 * `BatchedMesh` descendants instead union their own object-level `boundingBox`
 * (which three derives from `geometry.boundingBox × every per-instance matrix`)
 * so a batched grid frames its whole extent, not one base tile at the origin.
 *
 * Why not `setFromObject`: it prefers a mesh's own `object.boundingBox` over
 * `geometry.boundingBox` whenever one is defined. `THREE.SkinnedMesh` defines
 * `boundingBox` and computes it lazily from POSED vertices; for GLTF-cloned
 * skinned meshes that cached box lands in a corrupted frame far from the origin,
 * collapsing selection boxes onto the world origin. Using `geometry.boundingBox`
 * (the stable bind-pose AABB) × `matrixWorld` is the correct world-space box for
 * the rendered (rest-pose) model — matching Godot's editor, which selects by the
 * mesh AABB rather than the live pose. `InstancedMesh` / `BatchedMesh` are the
 * ONE object-level exception: their `boundingBox` is a trustworthy union over
 * instances (not a posed box), so those descendants are unioned via it — losing
 * that path collapses a Godot GridMap to a single tile.
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
 * Union of every descendant's world-space bounding box. Refreshes world matrices
 * first so the box reflects the current transform chain. Ordinary meshes use
 * `geometry.boundingBox × matrixWorld` (deliberately ignoring the posed
 * `SkinnedMesh.boundingBox` — see the file header); `InstancedMesh` /
 * `BatchedMesh` use their object-level `boundingBox × matrixWorld` so every
 * instance counts. Returns an empty box when no descendant has geometry.
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

    // InstancedMesh / BatchedMesh carry an object-level box that unions every
    // per-instance matrix (NOT a posed box like SkinnedMesh); use that, else a
    // Godot GridMap would frame only one base tile at the mesh origin. Ordinary
    // meshes use `geometry.boundingBox` (the stable bind-pose AABB — see header).
    const src = bearing.isInstancedMesh || bearing.isBatchedMesh ? bearing : geometry;
    if (src.boundingBox === null) src.computeBoundingBox?.();
    if (!src.boundingBox) return;
    _box.copy(src.boundingBox).applyMatrix4(child.matrixWorld);
    target.union(_box);
  });
  return target;
}
