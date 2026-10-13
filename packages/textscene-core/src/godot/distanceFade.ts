/**
 * Godot's camera-distance fade, which a Decal and an omni or spot light share: per instance per
 * frame on the distance from the camera's origin to the instance's
 * (`storage_rd/texture_storage.cpp:3342-3385`, `storage_rd/light_storage.cpp:767-863`).
 */

import { smoothstep } from './math.js';

/** `Light3D`'s distance fade defaults (`scene/3d/light_3d.h:79-81`). */
export const LIGHT_DISTANCE_FADE_DEFAULT = { begin: 40, shadow: 50, length: 10 } as const;

/**
 * The fade at `distance`. Godot drops the instance past `begin + length` before the smoothstep,
 * which makes `length = 0` a hard cut at `begin`, not a division by zero.
 */
export function distanceFade(begin: number, length: number, distance: number): number {
  if (distance > begin + length) return 0;
  if (distance <= begin) return 1;
  return smoothstep(0, 1, 1 - (distance - begin) / length);
}
