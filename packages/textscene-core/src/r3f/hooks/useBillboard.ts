/**
 * A whole-node billboard, applied per frame, for the nodes that own `billboard`: Sprite3D,
 * Label3D and the AudioStreamPlayer3D gizmo. A material's `billboard_mode` is per surface
 * instead (`surfaceDrawHooks.ts`). SpriteBase3D refuses PARTICLES, so it reads as ENABLED.
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
    if (!object || mode === undefined || mode === BillboardMode.BILLBOARD_DISABLED) return;
    // FIXED_Y pins world +Y as the up basis, so only the yaw turns.
    if (mode === BillboardMode.BILLBOARD_FIXED_Y) {
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
