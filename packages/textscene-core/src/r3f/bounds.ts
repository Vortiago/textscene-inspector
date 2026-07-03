/**
 * `computeWorldBoundingBox` — union of every descendant's `geometry.boundingBox`
 * transformed by its `matrixWorld`, instead of `THREE.Box3.setFromObject`.
 *
 * Why: `setFromObject` prefers a mesh's own `object.boundingBox` over
 * `geometry.boundingBox`. `THREE.SkinnedMesh` defines `boundingBox` and computes
 * it lazily from POSED vertices; for GLTF-cloned skinned meshes that cached box
 * lands in a corrupted frame far from the origin, collapsing selection boxes to
 * the world origin. `geometry.boundingBox` is the bind-pose AABB in local space
 * and is stable; `geometry.boundingBox × matrixWorld` is the correct world-space
 * box for the rendered (rest-pose) model.
 */
import * as THREE from 'three';

const _box = /*@__PURE__*/ new THREE.Box3();

/** Object3D shape that may carry a geometry (Mesh, SkinnedMesh, Line, Points). */
interface GeometryBearing extends THREE.Object3D {
  geometry?: THREE.BufferGeometry;
}

/**
 * Union of every descendant's `geometry.boundingBox` transformed by its
 * `matrixWorld`. Refreshes world matrices first so the box reflects the current
 * transform chain. Deliberately ignores `SkinnedMesh.boundingBox` (the posed
 * box) — see the file header. Returns an empty box when no descendant has
 * geometry.
 */
export function computeWorldBoundingBox(
  object: THREE.Object3D,
  target: THREE.Box3 = new THREE.Box3()
): THREE.Box3 {
  target.makeEmpty();
  object.updateWorldMatrix(true, true);
  object.traverse((child) => {
    const geometry = (child as GeometryBearing).geometry;
    if (!geometry) return;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    _box.copy(geometry.boundingBox).applyMatrix4(child.matrixWorld);
    target.union(_box);
  });
  return target;
}
