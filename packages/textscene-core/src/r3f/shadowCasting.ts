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
 *
 * Every value also has to reach that depth material to undo three's own
 * FrontSide↔BackSide flip, which Godot's shadow pass does not do.
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

/**
 * three passes the OBJECT as the second `onBeforeShadow` argument
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
 * Godot's shadow pass keeps the material's own cull: CULL_VARIANT_DOUBLE_SIDED
 * is taken only for FLAG_USES_DOUBLE_SIDED_SHADOWS, and everything else falls
 * through to NORMAL/REVERSED (`render_forward_clustered.cpp:395-411`). three
 * instead flips FrontSide↔BackSide for the depth material as its own acne
 * mitigation (`WebGLShadowMap.js:51`, applied at `:477`); undo that.
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
