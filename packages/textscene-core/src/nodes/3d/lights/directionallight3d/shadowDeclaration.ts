/**
 * The shadow a DirectionalLight3D declares to the scene's shadow fitter, with Godot's class default
 * for each property it leaves out. The editor's preview sun declares through this too, so the two
 * suns cannot drift apart.
 */

import { DIRECTIONAL_LIGHT_3D_DEFAULTS as DEFAULTS } from '../../../../godot/scene/light';
import {
  directionalShadowSplitCount,
  sharesDirectionalShadowAtlas,
} from '../../../../godot/rendering/lights/directionalShadow';
import { directionalLightLightsSurfaces } from '../../../../godot/rendering/lights/directionalLightSkyMode';
import { softShadowScale } from '../../../../godot/rendering/lights/softShadowScale';
import {
  drawsDirectionalSoftShadow,
  softShadowAngle,
} from '../../../../godot/rendering/lights/directionalSoftShadow';
import type { DirectionalShadowDeclaration } from '../../../../r3f/directionalShadow/declaration';
import { directionalShadowBias } from '../shared/shadowBias';
import type { DirectionalLight3DProperties } from './types';

/** The properties a DirectionalLight3D's shadow reads. */
type DirectionalShadowProperties = Pick<
  DirectionalLight3DProperties,
  | 'shadow_enabled'
  | 'shadow_bias'
  | 'shadow_blur'
  | 'shadow_normal_bias'
  | 'light_angular_distance'
  | 'sky_mode'
  | 'directional_shadow_mode'
  | 'directional_shadow_split_1'
  | 'directional_shadow_split_2'
  | 'directional_shadow_split_3'
  | 'directional_shadow_blend_splits'
  | 'directional_shadow_max_distance'
  | 'directional_shadow_pancake_size'
  | 'directional_shadow_fade_start'
>;

export function directionalShadowDeclaration(
  properties: DirectionalShadowProperties
): DirectionalShadowDeclaration {
  const angularDistance = properties.light_angular_distance ?? DEFAULTS.size;
  const skyMode = properties.sky_mode ?? DEFAULTS.skyMode;
  const filterRadius = softShadowScale(properties.shadow_blur, angularDistance);
  return {
    maxDistance: properties.directional_shadow_max_distance ?? DEFAULTS.shadowMaxDistance,
    pancakeSize: properties.directional_shadow_pancake_size ?? DEFAULTS.shadowPancakeSize,
    fadeStart: properties.directional_shadow_fade_start ?? DEFAULTS.shadowFadeStart,
    depthBias: directionalShadowBias(properties.shadow_bias, filterRadius),
    normalBias: properties.shadow_normal_bias ?? DEFAULTS.shadowNormalBias,
    filterRadius,
    softShadowAngle: softShadowAngle(angularDistance),
    drawsSoftShadow: drawsDirectionalSoftShadow({
      angularDistance,
      shadowEnabled: properties.shadow_enabled,
      shadowBlur: properties.shadow_blur ?? DEFAULTS.shadowBlur,
      lightsSurfaces: directionalLightLightsSurfaces(skyMode),
    }),
    splitCount: directionalShadowSplitCount(properties.directional_shadow_mode ?? DEFAULTS.shadowMode),
    splitOffsets: [
      properties.directional_shadow_split_1 ?? DEFAULTS.shadowSplitOffsets[0],
      properties.directional_shadow_split_2 ?? DEFAULTS.shadowSplitOffsets[1],
      properties.directional_shadow_split_3 ?? DEFAULTS.shadowSplitOffsets[2],
    ],
    blendSplits: properties.directional_shadow_blend_splits ?? DEFAULTS.blendSplits,
    sharesAtlas: sharesDirectionalShadowAtlas(properties.shadow_enabled, skyMode),
  };
}
