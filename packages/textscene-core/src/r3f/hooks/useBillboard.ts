/**
 * A whole-node billboard, applied per frame, for the nodes that own `billboard`: Sprite3D,
 * Label3D and the AudioStreamPlayer3D gizmo. A material's `billboard_mode` is per surface
 * instead (`surfaceDrawHooks.ts`). Both draw through `billboardWorldMatrix`, as Godot's
 * SpriteBase3D and Label3D hand their mode to the same material shader (`sprite_3d.cpp:299`).
 */

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RefObject } from 'react';
import { BillboardMode } from '../../godot/billboard';
import { billboardWorldMatrix } from '../surfaceBillboard';

export function useBillboard(ref: RefObject<THREE.Object3D | null>, mode: number | undefined): void {
  useFrame(({ camera }) => {
    const object = ref.current;
    if (object) applyBillboard(object, camera, mode);
  });
}

/** Scratch, overwritten by every call: this runs on every rendered frame. */
const model = new THREE.Matrix4();

/**
 * Writes `object.matrixWorld` as Godot's billboard shader builds it, from the camera's axes and
 * the node's world origin, and stops three recomputing it. `get_material_for_2d` turns on
 * `FLAG_BILLBOARD_KEEP_SCALE` with either mode (`material.cpp:3056-3058`), so the node keeps its
 * world scale. Any other mode hands the world matrix back to three.
 */
export function applyBillboard(object: THREE.Object3D, camera: THREE.Camera, mode: number | undefined): void {
  const billboards = mode === BillboardMode.BILLBOARD_ENABLED || mode === BillboardMode.BILLBOARD_FIXED_Y;
  object.matrixWorldAutoUpdate = !billboards;
  if (!billboards) return;

  object.updateMatrix();
  object.parent?.updateWorldMatrix(true, false);
  if (object.parent) model.multiplyMatrices(object.parent.matrixWorld, object.matrix);
  else model.copy(object.matrix);
  camera.updateMatrixWorld();

  if (!billboardWorldMatrix(object.matrixWorld, model, camera.matrixWorld, { mode, keepScale: true })) {
    object.matrixWorld.copy(model);
  }
}
