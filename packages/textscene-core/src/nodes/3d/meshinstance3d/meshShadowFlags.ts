/** Godot's `cast_shadow` enum decoded into what the renderer needs from it. */

import * as THREE from 'three';

export interface ShadowFlags {
  castShadow: boolean;
  /** Mesh still casts a shadow but isn't drawn into the colour buffer. */
  shadowsOnly: boolean;
  /** Override material.shadowSide so both faces participate in the shadow pass. */
  shadowSide?: THREE.Side;
}

/**
 * Decode Godot's `cast_shadow` enum (0=OFF, 1=ON, 2=DOUBLE_SIDED,
 * 3=SHADOWS_ONLY) into the three flags the renderer needs.
 *
 * All four modes are distinct: a single boolean cannot carry 2 or 3, which both
 * cast while differing in which faces do it and whether the mesh is drawn.
 */
export function shadowCastingFlags(value: number | undefined): ShadowFlags {
  // class_geometryinstance3d.html: cast_shadow defaults to 1
  // (SHADOW_CASTING_SETTING_ON), so an absent key means the mesh DOES cast.
  if (value === 0) {
    return { castShadow: false, shadowsOnly: false };
  }
  if (value === 2) {
    return { castShadow: true, shadowsOnly: false, shadowSide: THREE.DoubleSide };
  }
  if (value === 3) {
    return { castShadow: true, shadowsOnly: true };
  }
  return { castShadow: true, shadowsOnly: false };
}
