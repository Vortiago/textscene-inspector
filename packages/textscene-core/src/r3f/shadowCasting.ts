/**
 * `cast_shadow` to its three-side effects. It is GeometryInstance3D state
 * (`servers/rendering/renderer_scene_cull.cpp:732`), never material state, since a
 * `.tres` material is shared. `RS::ShadowCastingSetting` has four values
 * (`servers/rendering/rendering_server.h:1494-1499`) and `castShadow` is a boolean,
 * so the rest reaches three through the per-surface draw hooks (`surfaceDrawHooks.ts`).
 */

import * as THREE from 'three';
import { ShadowCastingSetting } from '../resources/meshlibrary/types';
import { surfaceDrawHooks, type CastRule, type SurfaceDrawHooks } from './surfaceDrawHooks';

/** What every GeometryInstance3D consumer mounts: `castShadow` and the four draw hooks. */
export interface ShadowCastingEffects extends SurfaceDrawHooks {
  /** `Object3D.castShadow`. */
  castShadow: boolean;
  /** SHADOWS_ONLY: casts, and the hooks keep it out of the colour pass. */
  shadowsOnly: boolean;
}

/**
 * Godot's shadow pass keeps the material's own cull unless it uses double-sided
 * shadows (`render_forward_clustered.cpp:395-411`). three flips FrontSide↔BackSide
 * for the depth material against acne (`WebGLShadowMap.js:51`, applied at `:477`),
 * and every value undoes that. `shadowSide` is three's own per-material override.
 */
function materialCull(depthMaterial: THREE.Material, material: THREE.Material): void {
  depthMaterial.side = material.shadowSide ?? material.side;
}

/**
 * DOUBLE_SIDED sets `cast_double_sided_shadows`, which drops the shadow pass's
 * cull. Safe on three's shared depth material: `getDepthMaterial` reassigns `side`
 * per object before the hook (`WebGLShadowMap.js:477`), so nothing leaks.
 */
function bothFaces(depthMaterial: THREE.Material): void {
  depthMaterial.side = THREE.DoubleSide;
}

function castEffects(castShadow: boolean, rule: CastRule): ShadowCastingEffects {
  return Object.freeze({ castShadow, shadowsOnly: rule.shadowsOnly, ...surfaceDrawHooks(rule) });
}

// One frozen result per value: an unstable object would churn the mesh props.
const OFF = castEffects(false, { shadowsOnly: false, shadowSide: materialCull });
const ON = castEffects(true, { shadowsOnly: false, shadowSide: materialCull });
const DOUBLE_SIDED = castEffects(true, { shadowsOnly: false, shadowSide: bothFaces });
const SHADOWS_ONLY = castEffects(true, { shadowsOnly: true, shadowSide: materialCull });

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

/** The JSX props, applied to an object built outside JSX, such as GridMap's InstancedMesh. */
export function applyShadowCasting(object: THREE.Object3D, effects: ShadowCastingEffects): void {
  object.castShadow = effects.castShadow;
  object.onBeforeRender = effects.onBeforeRender;
  object.onAfterRender = effects.onAfterRender;
  object.onBeforeShadow = effects.onBeforeShadow;
  object.onAfterShadow = effects.onAfterShadow;
}
