/**
 * `cast_shadow` → the three-side effects it produces.
 *
 * `cast_shadow` is GeometryInstance3D state applied at shadow-pipeline time
 * (`servers/rendering/renderer_scene_cull.cpp:732`), never material state — a
 * `.tres` material is shared by every node referencing it, so nothing here may
 * be written onto one. `RS::ShadowCastingSetting`
 * (`servers/rendering/rendering_server.h:1494-1499`) has four values and
 * `Object3D.castShadow` is a boolean, so two of them need more:
 * SHADOWS_ONLY has to leave the colour pass while still casting, and
 * DOUBLE_SIDED has to reach the depth material three built for this mesh.
 */

import * as THREE from 'three';
import { ShadowCastingSetting } from '../resources/meshlibrary/types';

export interface ShadowCastingEffects {
  /** `Object3D.castShadow`. */
  castShadow: boolean;
  /** SHADOWS_ONLY: casts, but the caller must keep it out of the colour buffer. */
  shadowsOnly: boolean;
  /** `Object3D.onBeforeShadow` — the per-mesh reach into three's depth material. */
  onBeforeShadow: THREE.Object3D['onBeforeShadow'];
}

/** three's default hook is a no-op; keep an own property so R3F never unsets it. */
const keepShadowSide: THREE.Object3D['onBeforeShadow'] = () => {};

/**
 * DOUBLE_SIDED sets `cast_double_sided_shadows`, which drops the shadow pass's
 * cull (`render_forward_clustered.cpp:395-411`). Safe on three's SHARED depth
 * material: `getDepthMaterial` reassigns `side` for every object before the
 * hook fires (`WebGLShadowMap.js:477`), so nothing leaks to the next mesh.
 */
const castDoubleSidedShadow: THREE.Object3D['onBeforeShadow'] = (
  _renderer,
  _scene,
  _camera,
  _shadowCamera,
  _geometry,
  depthMaterial
) => {
  depthMaterial.side = THREE.DoubleSide;
};

// One frozen result per value: an unstable object would churn the mesh prop.
const OFF: ShadowCastingEffects = Object.freeze({
  castShadow: false,
  shadowsOnly: false,
  onBeforeShadow: keepShadowSide,
});
// ON keeps three's FrontSide↔BackSide flip (`WebGLShadowMap.js:51`).
const ON: ShadowCastingEffects = Object.freeze({
  castShadow: true,
  shadowsOnly: false,
  onBeforeShadow: keepShadowSide,
});
const DOUBLE_SIDED: ShadowCastingEffects = Object.freeze({
  castShadow: true,
  shadowsOnly: false,
  onBeforeShadow: castDoubleSidedShadow,
});
const SHADOWS_ONLY: ShadowCastingEffects = Object.freeze({
  castShadow: true,
  shadowsOnly: true,
  onBeforeShadow: keepShadowSide,
});

/** Absent or unrecognised `cast_shadow` is Godot's default, ON. */
export function shadowCastingEffects(value: number | undefined): ShadowCastingEffects {
  switch (value) {
    case ShadowCastingSetting.OFF:
      return OFF;
    case ShadowCastingSetting.DOUBLE_SIDED:
      return DOUBLE_SIDED;
    case ShadowCastingSetting.SHADOWS_ONLY:
      return SHADOWS_ONLY;
    default:
      return ON;
  }
}
