/**
 * Decal projection geometry — the faithful core of the Decal renderer.
 *
 * Godot's Decal is a slide projector: it casts `texture_albedo` down the node's
 * local -Y axis onto whatever surfaces sit inside an axis-aligned box of
 * dimensions `size` (centred on the node origin), clipped to that box, and
 * blends the result onto the lit surface. three.js reproduces this with
 * `DecalGeometry` (three/examples), which bakes the intersection of a target
 * mesh with a projector box into a new geometry lying on that surface.
 *
 * These helpers are pure over THREE objects (no React, no hooks) so the
 * projection maths is unit-testable in isolation — the R3F component only wires
 * them to the live scene. Two steps:
 *   1. `collectDecalReceivers` — find the scene meshes the box actually touches.
 *   2. `buildDecalProjectionGeometry` — project one receiver into the decal's
 *      own local frame (so the resulting mesh can hang under the decal's
 *      transform group, not the scene root).
 */

import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import type { Vector3 } from '../../../parser/vectors';
import { visualLayersOf } from '../../../r3f/visualLayers';
import { bakeDecalFadeAttribute, type DecalGeometricFade } from './decalFade';
import { DECAL_DEFAULT_CULL_MASK } from './parser';

/**
 * The projector orientation, expressed in the decal's LOCAL frame. Godot
 * projects along local -Y; `DecalGeometry` projects along its own local +Z and
 * lays the texture in its local X-Y plane. `Rx(+90°)` maps the projector's
 * local axes onto the decal's: projector Z → decal -Y (the projection axis),
 * projector X → decal +X, projector Y → decal +Z. Consequently the projector
 * `size` is `(godot.x, godot.z, godot.y)` — footprint X, footprint Z, depth Y.
 */
const PROJECTOR_ORIENTATION = new THREE.Euler(Math.PI / 2, 0, 0);
const PROJECTOR_ORIGIN = new THREE.Vector3(0, 0, 0);

/**
 * World-space AABB of the decal's projection box. Its eight local corners
 * (±size/2) are pushed through the decal's world matrix, so an arbitrarily
 * rotated/scaled decal still yields a correct axis-aligned bound for the cheap
 * receiver pre-filter below.
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
 * A scene object is a decal receiver when it is a real, visible mesh with
 * geometry, is NOT itself a decal projection (so decals never stamp onto each
 * other's output), and its Godot render layers survive the decal's `cull_mask`.
 * Gizmos are `LineSegments`/helpers, not `Mesh`, so they fall out here without
 * special-casing.
 *
 * The layer test is Godot's, exactly: a decal reaches an instance only when
 * `decal.cull_mask & instance.layer_mask` is non-zero — the CPU-side pairing
 * cull in `renderer_scene_cull.cpp` and, per fragment, the `continue //not
 * masked` guard in `scene_forward_clustered.glsl`. It is what lets a vehicle
 * carry a blob-shadow decal that darkens the ground it stands on without
 * painting the vehicle itself black.
 */
function isReceiverMesh(obj: THREE.Object3D, cullMask: number): obj is THREE.Mesh {
  const mesh = obj as THREE.Mesh;
  return (
    mesh.isMesh === true &&
    !!mesh.geometry &&
    obj.visible !== false &&
    obj.userData.isDecalProjection !== true &&
    (cullMask & visualLayersOf(obj)) !== 0
  );
}

/**
 * Every receiver mesh under `root` whose world bounding box overlaps the decal
 * box and whose render layers `cullMask` admits. The box overlap is only a
 * pre-filter: `DecalGeometry` does the exact per-triangle clipping, but skipping
 * non-overlapping meshes keeps a decal from walking the whole scene's triangles
 * and from producing empty geometries. The layer test, by contrast, is exact —
 * it is the whole of Godot's rule. `root` must have had `updateMatrixWorld(true)`
 * called by the caller so every `matrixWorld` is current.
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
    if (boxWorldAABB.intersectsBox(meshBox)) receivers.push(obj);
  });
  return receivers;
}

/**
 * Project one receiver into the DECAL'S local frame and return the baked decal
 * geometry, or `null` when the receiver's triangles clip to nothing inside the
 * box. Working in decal-local space (rather than the world space
 * `DecalGeometry` natively emits) means the resulting mesh can be parented under
 * the decal's own transform group without a compensating inverse transform.
 *
 * The trick: hand `DecalGeometry` a throwaway mesh sharing the receiver's
 * geometry but whose `matrixWorld` is `decalWorld⁻¹ · receiver.matrixWorld`.
 * `DecalGeometry` transforms vertices by that matrix (bringing them into
 * decal-local space) before clipping, so its "world"-space output already sits
 * in the decal's frame.
 */
export function buildDecalProjectionGeometry(
  receiver: THREE.Mesh,
  decalWorldInverse: THREE.Matrix4,
  size: Vector3,
  fade: DecalGeometricFade
): DecalGeometry | null {
  const proxy = new THREE.Mesh(receiver.geometry);
  proxy.matrixAutoUpdate = false;
  proxy.matrixWorld.copy(decalWorldInverse).multiply(receiver.matrixWorld);

  const projectorSize = new THREE.Vector3(size.x, size.z, size.y);
  const geometry = new DecalGeometry(proxy, PROJECTOR_ORIGIN, PROJECTOR_ORIENTATION, projectorSize);

  const position = geometry.getAttribute('position');
  if (!position || position.count === 0) {
    geometry.dispose();
    return null;
  }

  // Flip V. Textures load with `flipY = true` (three's default, the convention
  // arrayMeshGeometry/tileGeometry also work against), so V = 0 samples the
  // image BOTTOM — but Godot's decal V-origin is the image TOP. Without this a
  // projected texture is mirrored vertically: a directional albedo comes out
  // upside-down, and an even checkerboard comes out with its cells inverted.
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, 1 - uv.getY(i));
  }
  uv.needsUpdate = true;

  // Godot's depth and normal fades, baked per vertex. Both are pure functions
  // of the attributes just emitted, because those are already in the decal's
  // own frame — see decalFade.ts for why that makes the bake exact rather than
  // an approximation, and where it is not.
  bakeDecalFadeAttribute(geometry, fade, size.y);

  return geometry;
}
