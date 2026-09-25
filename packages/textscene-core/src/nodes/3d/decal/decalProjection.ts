/**
 * Decal projection geometry. Godot's Decal casts `texture_albedo` down local -Y onto the surfaces
 * inside an origin-centred box of `size`, and three's `DecalGeometry` bakes the intersection of a
 * mesh with a projector box into a geometry on that surface. Pure over THREE objects, with no
 * React, so the maths tests in isolation and the component only wires it to the live scene.
 */

import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import type { Vector3 } from '../../../parser/vectors';
import { visualLayersOf } from '../../../r3f/visualLayers';
import { bakeDecalFadeAttribute, type DecalGeometricFade } from './decalFade';
import { DECAL_DEFAULT_CULL_MASK } from './parser';

/**
 * The projector orientation in the decal's local frame. Godot projects along local -Y, and
 * `DecalGeometry` along its local +Z with the texture in its X-Y plane. `Rx(+90°)` maps projector
 * Z → decal -Y, X → +X and Y → +Z, so the projector `size` is `(godot.x, godot.z, godot.y)`:
 * footprint X, footprint Z, depth Y.
 */
const PROJECTOR_ORIENTATION = new THREE.Euler(Math.PI / 2, 0, 0);
const PROJECTOR_ORIGIN = new THREE.Vector3(0, 0, 0);

/**
 * World-space AABB of the decal's projection box: its eight local corners (±size/2) pass through
 * the decal's world matrix, so a rotated or scaled decal still yields a correct bound for the
 * receiver pre-filter.
 */
export function computeDecalBoxWorldAABB(decalWorld: THREE.Matrix4, size: Vector3): THREE.Box3 {
  const hx = size.x / 2;
  const hy = size.y / 2;
  const hz = size.z / 2;
  const box = new THREE.Box3().makeEmpty();
  const corner = new THREE.Vector3();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corner.set(sx * hx, sy * hy, sz * hz).applyMatrix4(decalWorld);
        box.expandByPoint(corner);
      }
    }
  }
  return box;
}

/**
 * A decal receiver: a visible mesh with geometry that is not itself a decal projection, so decals
 * never stamp onto each other's output, and whose render layers survive the decal's `cull_mask`.
 * Gizmos are `LineSegments` or helpers, not `Mesh`, so they fall out without special-casing.
 */
function isReceiverMesh(obj: THREE.Object3D, cullMask: number): obj is THREE.Mesh {
  const mesh = obj as THREE.Mesh;
  return (
    mesh.isMesh === true &&
    !!mesh.geometry &&
    obj.visible !== false &&
    obj.userData.isDecalProjection !== true &&
    // Godot's test: `decal.cull_mask & instance.layer_mask` is non-zero, the pairing cull in
    // `renderer_scene_cull.cpp` and the per-fragment `continue //not masked` guard in
    // `scene_forward_clustered.glsl`. A vehicle's blob-shadow decal then darkens the ground
    // without painting the vehicle black.
    (cullMask & visualLayersOf(obj)) !== 0
  );
}

/**
 * Every receiver mesh under `root` whose world bounding box overlaps the decal box and whose
 * render layers `cullMask` admits. The caller runs `updateMatrixWorld(true)` on `root` first, so
 * every `matrixWorld` is current. The layer test is exact, the whole of Godot's rule.
 */
export function collectDecalReceivers(
  root: THREE.Object3D,
  boxWorldAABB: THREE.Box3,
  cullMask: number = DECAL_DEFAULT_CULL_MASK
): THREE.Mesh[] {
  const receivers: THREE.Mesh[] = [];
  const meshBox = new THREE.Box3();
  root.traverse((obj) => {
    if (!isReceiverMesh(obj, cullMask)) return;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const local = obj.geometry.boundingBox;
    if (!local) return;
    meshBox.copy(local).applyMatrix4(obj.matrixWorld);
    // Only a pre-filter: `DecalGeometry` clips per triangle, but skipping a mesh outside the box
    // spares its triangles and an empty geometry.
    if (boxWorldAABB.intersectsBox(meshBox)) receivers.push(obj);
  });
  return receivers;
}

/**
 * Project one receiver into the decal's local frame and return the baked decal geometry, or
 * `null` when the receiver's triangles clip to nothing inside the box. Decal-local space, not the
 * world space `DecalGeometry` emits, lets the mesh hang under the decal's transform group without
 * a compensating inverse transform.
 */
export function buildDecalProjectionGeometry(
  receiver: THREE.Mesh,
  decalWorldInverse: THREE.Matrix4,
  size: Vector3,
  fade: DecalGeometricFade
): DecalGeometry | null {
  const proxy = new THREE.Mesh(receiver.geometry);
  // `DecalGeometry` transforms vertices by the mesh's `matrixWorld` before clipping, so a proxy
  // at `decalWorld⁻¹ · receiver.matrixWorld` makes its "world" output land in the decal's frame.
  proxy.matrixAutoUpdate = false;
  proxy.matrixWorld.copy(decalWorldInverse).multiply(receiver.matrixWorld);

  const projectorSize = new THREE.Vector3(size.x, size.z, size.y);
  const geometry = new DecalGeometry(proxy, PROJECTOR_ORIGIN, PROJECTOR_ORIENTATION, projectorSize);

  const position = geometry.getAttribute('position');
  if (!position || position.count === 0) {
    geometry.dispose();
    return null;
  }

  // Flip V. Textures load with `flipY = true` (three's default, which
  // arrayMeshGeometry/tileGeometry also assume), so V = 0 samples the image bottom, but Godot's
  // decal V-origin is the image top. Without this a projected texture is mirrored vertically.
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, 1 - uv.getY(i));
  }
  uv.needsUpdate = true;

  // Godot's depth and normal fades, baked per vertex from the attributes just emitted, which are
  // already in the decal's frame. decalFade.ts says why that makes the bake exact, and where not.
  bakeDecalFadeAttribute(geometry, fade, size.y);

  return geometry;
}
