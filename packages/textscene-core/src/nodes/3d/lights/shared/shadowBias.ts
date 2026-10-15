/**
 * Godot `shadow_bias` → three `LightShadow.bias`. A directional light's is negated into three's
 * normalised depth. An omni or spot light's keeps Godot's unit, which the patched lookup reads.
 */

import { LIGHT_3D_DEFAULTS, SPOT_LIGHT_3D_DEFAULTS } from '../../../../godot/scene/light';
import {
  positionalSoftShadow,
  spotShadowDepthBias,
} from '../../../../godot/rendering/lights/positionalShadow';
import type { PositionalLightProperties } from './types';

/**
 * Exact: `light_storage.cpp:723` sends `shadow_bias / 100 * bias_scale` times `soft_shadow_scale`,
 * `renderer_scene_cull.cpp:2348` makes `bias_scale` the cascade's ortho depth range,
 * and `scene_forward_clustered.glsl:2304` spends it inside that range, so in
 * normalised depth the range cancels.
 */
export function directionalShadowBias(shadowBias: number, softShadowScale: number): number {
  return -(shadowBias / 100) * softShadowScale;
}

/**
 * In world units: Godot sends `shadow_bias` unscaled (`light_storage.cpp:973`), and scales it by
 * `soft_shadow_scale` in the spot branch alone (`:1024`). The omni lookup subtracts it from the
 * distance to the light (`scene_forward_lights_inc.glsl:594`, `positionalShadowLookup.ts`).
 */
export function omniShadowBias(shadowBias: number | undefined): number {
  return shadowBias ?? LIGHT_3D_DEFAULTS.shadowBias;
}

/** The properties a spot light's depth bias reads. */
type SpotBiasProperties = Pick<PositionalLightProperties, 'shadow_bias' | 'shadow_blur' | 'light_size'>;

/** In Godot's reversed clip depth, for the spot lookup Godot's shader runs (`positionalShadowLookup.ts`). */
export function spotShadowBias({ shadow_bias, shadow_blur, light_size }: SpotBiasProperties): number {
  const { scale } = positionalSoftShadow(
    light_size ?? SPOT_LIGHT_3D_DEFAULTS.size,
    shadow_blur ?? SPOT_LIGHT_3D_DEFAULTS.shadowBlur
  );
  return spotShadowDepthBias(shadow_bias ?? SPOT_LIGHT_3D_DEFAULTS.shadowBias, scale);
}
