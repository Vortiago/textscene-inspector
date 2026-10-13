/**
 * Godot `shadow_bias` → three `LightShadow.bias`. A directional light's is negated into three's
 * normalised depth. An omni or spot light's keeps Godot's unit, which the patched lookup reads.
 */

import { SHADOW_BLUR_DEFAULT, softShadowScale } from '../../../../godot/softShadowScale';
import {
  LIGHT_SIZE_DEFAULT,
  positionalSoftShadow,
  spotShadowDepthBias,
} from '../../../../godot/positionalShadow';
import { LIGHT_ANGULAR_DISTANCE_DEFAULT } from '../../../../godot/directionalSoftShadow';
import type { DirectionalLight3DProperties } from '../directionallight3d/types';
import type { PositionalLightProperties } from './types';

/** `scene/3d/light_3d.cpp:490` (Light3D) and `:681` (SpotLight3D). */
const GODOT_SHADOW_BIAS_DEFAULT = { DIRECTIONAL: 0.1, OMNI: 0.1, SPOT: 0.03 } as const;

/** The properties a directional light's depth bias reads. */
type DirectionalBiasProperties = Pick<
  DirectionalLight3DProperties,
  'shadow_bias' | 'shadow_blur' | 'light_angular_distance'
>;

/**
 * Exact: `light_storage.cpp:723` sends `shadow_bias / 100 * bias_scale`,
 * `renderer_scene_cull.cpp:2348` makes `bias_scale` the cascade's ortho depth range,
 * and `scene_forward_clustered.glsl:2304` spends it inside that range, so in
 * normalised depth the range cancels.
 */
export function directionalShadowBias({
  shadow_bias,
  shadow_blur,
  light_angular_distance,
}: DirectionalBiasProperties): number {
  const bias = shadow_bias ?? GODOT_SHADOW_BIAS_DEFAULT.DIRECTIONAL;
  return (
    -(bias / 100) * softShadowScale(shadow_blur, light_angular_distance ?? LIGHT_ANGULAR_DISTANCE_DEFAULT)
  );
}

/**
 * In world units: Godot sends `shadow_bias` unscaled (`light_storage.cpp:973`), and scales it by
 * `soft_shadow_scale` in the spot branch alone (`:1024`). The omni lookup subtracts it from the
 * distance to the light (`scene_forward_lights_inc.glsl:594`, `positionalShadowLookup.ts`).
 */
export function omniShadowBias(shadowBias: number | undefined): number {
  return shadowBias ?? GODOT_SHADOW_BIAS_DEFAULT.OMNI;
}

/** The properties a spot light's depth bias reads. */
type SpotBiasProperties = Pick<PositionalLightProperties, 'shadow_bias' | 'shadow_blur' | 'light_size'>;

/** In Godot's reversed clip depth, for the spot lookup Godot's shader runs (`positionalShadowLookup.ts`). */
export function spotShadowBias({ shadow_bias, shadow_blur, light_size }: SpotBiasProperties): number {
  const { scale } = positionalSoftShadow(
    light_size ?? LIGHT_SIZE_DEFAULT,
    shadow_blur ?? SHADOW_BLUR_DEFAULT
  );
  return spotShadowDepthBias(shadow_bias ?? GODOT_SHADOW_BIAS_DEFAULT.SPOT, scale);
}
