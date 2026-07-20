/**
 * Godot's `BaseMaterial3D.BillboardMode`, applied per frame to an Object3D.
 *
 * Shared by every slice that exposes `billboard` — Label3D and Sprite3D both
 * inherit it from SpriteBase3D/the label material. Sprite3D used to stash the
 * mode in `userData` with no reader anywhere, so billboarded sprites simply
 * never turned.
 *
 *   DISABLED (0) — no-op.
 *   ENABLED  (1) — copy the CAMERA'S BASIS. Godot's shader replaces the model
 *                  basis with `MAIN_CAM_INV_VIEW_MATRIX`'s, which is
 *                  screen-aligned; that is `quaternion.copy(camera.quaternion)`,
 *                  NOT `lookAt(camera.position)` (they differ off-centre).
 *   FIXED_Y  (2) — world +Y is pinned as the up basis, so only the yaw turns.
 *
 * PARTICLES (3) is a flipbook mode Sprite3D rejects outright
 * (`ERR_FAIL_INDEX(p_mode, 3)` in sprite_3d.cpp), so it is treated as ENABLED
 * the same way the parsers clamp it.
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
    if (mode === BILLBOARD_FIXED_Y) {
      const cp = camera.position;
      const op = object.position;
      object.rotation.set(0, Math.atan2(cp.x - op.x, cp.z - op.z), 0);
      return;
    }
    object.quaternion.copy(camera.quaternion);
  });
}
