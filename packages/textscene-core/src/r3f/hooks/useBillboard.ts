/**
 * Godot's `BaseMaterial3D.BillboardMode`, applied per frame to an Object3D, for every slice that
 * exposes `billboard`. PARTICLES (3) is a flipbook mode Sprite3D refuses
 * (`ERR_FAIL_INDEX(p_mode, 3)` in sprite_3d.cpp), so it is read as ENABLED, as the parsers clamp it.
 */

import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { RefObject } from 'react';

/** Godot `BillboardMode` integers, as they appear in a `.tscn`. */
export const BILLBOARD_DISABLED = 0;
export const BILLBOARD_ENABLED = 1;
export const BILLBOARD_FIXED_Y = 2;

export function useBillboard(
  ref: RefObject<THREE.Object3D | null>,
  mode: number | undefined
): void {
  useFrame(({ camera }) => {
    const object = ref.current;
    if (!object || mode === undefined || mode === BILLBOARD_DISABLED) return;
    // FIXED_Y pins world +Y as the up basis, so only the yaw turns.
    if (mode === BILLBOARD_FIXED_Y) {
      const cp = camera.position;
      const op = object.position;
      object.rotation.set(0, Math.atan2(cp.x - op.x, cp.z - op.z), 0);
      return;
    }
    // ENABLED takes the screen-aligned basis of `MAIN_CAM_INV_VIEW_MATRIX`: the camera's
    // quaternion, not `lookAt(camera.position)`, which differs off-centre.
    object.quaternion.copy(camera.quaternion);
  });
}
