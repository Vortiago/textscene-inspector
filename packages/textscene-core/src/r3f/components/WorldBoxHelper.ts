/**
 * `WorldBoxHelper` — a `THREE.BoxHelper` whose box is computed from each
 * descendant's **geometry** bounding box (the stable bind-pose AABB) times its
 * world matrix, instead of `THREE.Box3.setFromObject`.
 *
 * Why: `setFromObject` prefers a mesh's own `object.boundingBox` over
 * `geometry.boundingBox` when one is defined. `THREE.SkinnedMesh` defines
 * `boundingBox` and computes it lazily from POSED vertices
 * (`getVertexPosition` → `applyBoneTransform`, then `bindMatrixInverse`). For
 * skinned meshes loaded via `GLTFLoader` and cloned per-consumer (our GLB
 * pipeline), that posed/cached box lands in a corrupted frame — its raw
 * extents sit far from the origin and, once multiplied by the mesh's
 * `matrixWorld`, collapse the selection box onto the world origin even though
 * the model renders at its instance transform. The result: clicking a GLB
 * node (e.g. the platformer Player) drew the selection box nowhere near the
 * visible model.
 *
 * `geometry.boundingBox` is the bind-pose AABB in the mesh's local space and is
 * stable; `geometry.boundingBox × mesh.matrixWorld` is the correct world-space
 * box for the rendered (rest-pose) model — matching Godot's editor, which
 * selects by the mesh AABB rather than the live animated pose. Non-skinned
 * meshes are unaffected: `setFromObject` already used `geometry.boundingBox`
 * for them, so this reproduces the prior box exactly while fixing skinned ones.
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

const _helperBox = /*@__PURE__*/ new THREE.Box3();

/**
 * Drop-in `THREE.BoxHelper` that overrides `update()` to source its box from
 * {@link computeWorldBoundingBox}. Stays `instanceof THREE.BoxHelper` so
 * existing selection/hover lookups and the `useSceneHelper` lifecycle (which
 * calls `update()` each frame and `dispose()` on teardown) work unchanged.
 */
export class WorldBoxHelper extends THREE.BoxHelper {
  override update(): void {
    if (this.object === undefined) return;
    computeWorldBoundingBox(this.object, _helperBox);
    if (_helperBox.isEmpty()) return;

    const { min, max } = _helperBox;
    const position = this.geometry.attributes.position as THREE.BufferAttribute;
    const array = position.array as Float32Array;

    // Same 8-corner winding THREE.BoxHelper writes (see its source).
    array[0] = max.x; array[1] = max.y; array[2] = max.z;
    array[3] = min.x; array[4] = max.y; array[5] = max.z;
    array[6] = min.x; array[7] = min.y; array[8] = max.z;
    array[9] = max.x; array[10] = min.y; array[11] = max.z;
    array[12] = max.x; array[13] = max.y; array[14] = min.z;
    array[15] = min.x; array[16] = max.y; array[17] = min.z;
    array[18] = min.x; array[19] = min.y; array[20] = min.z;
    array[21] = max.x; array[22] = min.y; array[23] = min.z;

    position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}
