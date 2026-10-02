/**
 * Godot `shadow_bias` → three `LightShadow.bias`. A directional light's is negated into three's
 * normalised depth. An omni or spot light's keeps Godot's unit, which the patched lookup reads.
 */

import { softShadowScale } from '../../../../godot/softShadowScale';
import { omniShadowDepthBias, spotShadowDepthBias } from '../../../../godot/positionalShadow';

/** `scene/3d/light_3d.cpp:490` (Light3D) and `:681` (SpotLight3D). */
const GODOT_SHADOW_BIAS_DEFAULT = { DIRECTIONAL: 0.1, OMNI: 0.1, SPOT: 0.03 } as const;

/**
 * Exact: `light_storage.cpp:723` sends `shadow_bias / 100 * bias_scale`,
 * `renderer_scene_cull.cpp:2348` makes `bias_scale` the cascade's ortho depth range,
 * and `scene_forward_clustered.glsl:2304` spends it inside that range, so in
 * normalised depth the range cancels.
 */
export function directionalShadowBias(
  shadowBias: number | undefined,
  shadowBlur: number | undefined
): number {
  const bias = shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.DIRECTIONAL;
  return -(bias / 100) * softShadowScale(shadowBlur);
}

/**
 * In world units, for the omni lookup Godot's shader runs (`positionalShadowLookup.ts`). No
 * `soft_shadow_scale`: `light_storage.cpp:1024` sits in the spot branch alone.
 */
export function omniShadowBias(shadowBias: number | undefined): number {
  return omniShadowDepthBias(shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.OMNI);
}

/** In Godot's reversed clip depth, for the spot lookup Godot's shader runs (`positionalShadowLookup.ts`). */
export function spotShadowBias(shadowBias: number | undefined, shadowBlur: number | undefined): number {
  return spotShadowDepthBias(shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.SPOT, softShadowScale(shadowBlur));
}
