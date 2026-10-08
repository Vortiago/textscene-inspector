/**
 * `cast_shadow`, GeometryInstance3D state (`renderer_scene_cull.cpp:732`) and never material
 * state, since a `.tres` material is shared. Its four values (`rendering_server.h:1494-1499`)
 * outgrow three's boolean `castShadow`, so the rest rides the per-surface draw hooks.
 */

import * as THREE from 'three';
import { ShadowCastingSetting } from '../godot/rendering';
import {
  ALWAYS_VISIBLE,
  poseColourDraw,
  skipColourDraw,
  surfaceDrawHooks,
  type CastRule,
  type RangeGate,
  type SurfaceDrawHooks,
} from './surfaceDrawHooks';

/** What every GeometryInstance3D consumer mounts: `castShadow` and the four draw hooks. */
export interface ShadowCastingEffects extends SurfaceDrawHooks {
  /** `Object3D.castShadow`. */
  castShadow: boolean;
}

/**
 * Godot's shadow pass keeps the material's own cull unless it uses double-sided
 * shadows (`render_forward_clustered.cpp:395-411`). three flips FrontSide↔BackSide
 * for the depth material against acne (`WebGLShadowMap.js:51`, applied at `:488`),
 * and every value undoes that. `shadowSide` is three's own per-material override.
 */
function materialCull(depthMaterial: THREE.Material, material: THREE.Material): void {
  depthMaterial.side = material.shadowSide ?? material.side;
}

/**
 * DOUBLE_SIDED sets `cast_double_sided_shadows`, which drops the shadow pass's
 * cull. Safe on three's shared depth material: `getDepthMaterial` reassigns `side`
 * per object before the hook (`WebGLShadowMap.js:484-488`), so nothing leaks.
 */
function bothFaces(depthMaterial: THREE.Material): void {
  depthMaterial.side = THREE.DoubleSide;
}

/** What each `cast_shadow` value sets: three's `castShadow`, and the rule its draw hooks follow. */
interface CastSetting {
  castShadow: boolean;
  rule: CastRule;
}

const CAST_SETTINGS: Readonly<Record<ShadowCastingSetting, CastSetting>> = {
  [ShadowCastingSetting.OFF]: {
    castShadow: false,
    rule: { colourDraw: poseColourDraw, shadowSide: materialCull },
  },
  [ShadowCastingSetting.ON]: {
    castShadow: true,
    rule: { colourDraw: poseColourDraw, shadowSide: materialCull },
  },
  [ShadowCastingSetting.DOUBLE_SIDED]: {
    castShadow: true,
    rule: { colourDraw: poseColourDraw, shadowSide: bothFaces },
  },
  [ShadowCastingSetting.SHADOWS_ONLY]: {
    castShadow: true,
    rule: { colourDraw: skipColourDraw, shadowSide: materialCull },
  },
};

/** Absent or unrecognised `cast_shadow` is Godot's default, ON. */
function castSettingOf(value: number | undefined): CastSetting {
  return CAST_SETTINGS[value as ShadowCastingSetting] ?? CAST_SETTINGS[ShadowCastingSetting.ON];
}

function castEffects({ castShadow, rule }: CastSetting, gate: RangeGate): ShadowCastingEffects {
  return Object.freeze({ castShadow, ...surfaceDrawHooks(rule, gate) });
}

// One frozen result per value: an unstable object would churn the mesh props.
const UNRANGED_EFFECTS = new Map(
  Object.values(CAST_SETTINGS).map((setting) => [setting, castEffects(setting, ALWAYS_VISIBLE)])
);

/** The effects of an instance with no visibility range. */
export function shadowCastingEffects(value: number | undefined): ShadowCastingEffects {
  return UNRANGED_EFFECTS.get(castSettingOf(value))!;
}

/** The effects of an instance whose visibility-range cull writes `gate`. A new object per call. */
export function rangedShadowCastingEffects(value: number | undefined, gate: RangeGate): ShadowCastingEffects {
  return castEffects(castSettingOf(value), gate);
}

/** The JSX props, applied to an object built outside JSX, such as a GLB's meshes. */
export function applyShadowCasting(object: THREE.Object3D, effects: ShadowCastingEffects): void {
  object.castShadow = effects.castShadow;
  object.onBeforeRender = effects.onBeforeRender;
  object.onAfterRender = effects.onAfterRender;
  object.onBeforeShadow = effects.onBeforeShadow;
  object.onAfterShadow = effects.onAfterShadow;
}
