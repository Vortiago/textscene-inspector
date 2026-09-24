/**
 * `cast_shadow` to its three-side effects. It is GeometryInstance3D state
 * (`servers/rendering/renderer_scene_cull.cpp:732`), never material state, since a
 * `.tres` material is shared. `RS::ShadowCastingSetting` has four values
 * (`servers/rendering/rendering_server.h:1494-1499`) and `castShadow` is a boolean.
 */

import * as THREE from 'three';
import { ShadowCastingSetting } from '../resources/meshlibrary/types';

export interface ShadowCastingEffects {
  /** `Object3D.castShadow`. */
  castShadow: boolean;
  /** SHADOWS_ONLY: casts, and the caller keeps it out of the colour buffer. */
  shadowsOnly: boolean;
  /** `Object3D.onBeforeShadow`: the per-mesh reach into three's depth material. */
  onBeforeShadow: THREE.Object3D['onBeforeShadow'];
}

/**
 * three passes the object as the second `onBeforeShadow` argument
 * (`WebGLShadowMap.js:535,549`) and the geometry group as the last, but types
 * them `Scene` and `Group`. Narrow to what this file reads.
 */
type ShadowHookObject = { material?: THREE.Material | THREE.Material[] };
type ShadowHookGroup = { materialIndex?: number } | null;

function drawnMaterial(object: unknown, group: unknown): THREE.Material | undefined {
  const material = (object as ShadowHookObject | null)?.material;
  if (!Array.isArray(material)) return material;
  return material[(group as ShadowHookGroup)?.materialIndex ?? 0];
}

/**
 * Godot's shadow pass keeps the material's own cull unless it uses double-sided
 * shadows (`render_forward_clustered.cpp:395-411`). three flips FrontSide↔BackSide
 * for the depth material against acne (`WebGLShadowMap.js:51`, applied at `:477`),
 * and every value undoes that.
 */
const castWithMaterialCull: THREE.Object3D['onBeforeShadow'] = (
  _renderer,
  object,
  _camera,
  _shadowCamera,
  _geometry,
  depthMaterial,
  group
) => {
  const material = drawnMaterial(object, group);
  // `shadowSide` is three's own per-material override; leave it winning.
  if (material) depthMaterial.side = material.shadowSide ?? material.side;
};

/**
 * DOUBLE_SIDED sets `cast_double_sided_shadows`, which drops the shadow pass's
 * cull. Safe on three's shared depth material: `getDepthMaterial` reassigns `side`
 * per object before the hook (`WebGLShadowMap.js:477`), so nothing leaks.
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
  onBeforeShadow: castWithMaterialCull,
});
const ON: ShadowCastingEffects = Object.freeze({
  castShadow: true,
  shadowsOnly: false,
  onBeforeShadow: castWithMaterialCull,
});
const DOUBLE_SIDED: ShadowCastingEffects = Object.freeze({
  castShadow: true,
  shadowsOnly: false,
  onBeforeShadow: castDoubleSidedShadow,
});
const SHADOWS_ONLY: ShadowCastingEffects = Object.freeze({
  castShadow: true,
  shadowsOnly: true,
  onBeforeShadow: castWithMaterialCull,
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
