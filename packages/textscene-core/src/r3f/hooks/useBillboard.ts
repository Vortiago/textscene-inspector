/**
 * A whole-node billboard, applied per frame to an Object3D, for the slices whose node owns
 * `billboard` (Sprite3D, Label3D, the AudioStreamPlayer3D gizmo). A material's
 * `billboard_mode` is per surface instead (`r3f/surfaceDrawHooks.ts`). PARTICLES (3) is a
 * flipbook mode Sprite3D refuses (`ERR_FAIL_INDEX(p_mode, 3)` in sprite_3d.cpp), so it is
 * read as ENABLED, as the parsers clamp it.
 */

import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { RefObject } from 'react';
import { BillboardMode } from '../../godot/billboard';

export function useBillboard(
  ref: RefObject<THREE.Object3D | null>,
  mode: number | undefined
): void {
  useFrame(({ camera }) => {
    const object = ref.current;
    if (!object || mode === undefined || mode === BillboardMode.DISABLED) return;
    // FIXED_Y pins world +Y as the up basis, so only the yaw turns.
    if (mode === BillboardMode.FIXED_Y) {
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
