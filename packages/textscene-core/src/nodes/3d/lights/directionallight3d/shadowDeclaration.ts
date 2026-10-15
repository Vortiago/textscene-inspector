/**
 * The shadow a DirectionalLight3D declares to the scene's shadow fitter, with Godot's class default
 * for each property it leaves out. The editor's preview sun declares through this too, so the two
 * suns cannot drift apart.
 */

import { DIRECTIONAL_LIGHT_3D_DEFAULTS } from '../../../../godot/scene/light';
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
  const angularDistance = properties.light_angular_distance ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.size;
  const skyMode = properties.sky_mode ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.skyMode;
  const shadowBlur = properties.shadow_blur ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowBlur;
  const filterRadius = softShadowScale(shadowBlur, angularDistance);
  return {
    maxDistance:
      properties.directional_shadow_max_distance ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowMaxDistance,
    pancakeSize:
      properties.directional_shadow_pancake_size ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowPancakeSize,
    fadeStart: properties.directional_shadow_fade_start ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowFadeStart,
    depthBias: directionalShadowBias(
      properties.shadow_bias ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowBias,
      filterRadius
    ),
    normalBias: properties.shadow_normal_bias ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowNormalBias,
    filterRadius,
    softShadowAngle: softShadowAngle(angularDistance),
    drawsSoftShadow: drawsDirectionalSoftShadow({
      angularDistance,
      shadowEnabled: properties.shadow_enabled,
      shadowBlur,
      lightsSurfaces: directionalLightLightsSurfaces(skyMode),
    }),
    splitCount: directionalShadowSplitCount(
      properties.directional_shadow_mode ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowMode
    ),
    splitOffsets: [
      properties.directional_shadow_split_1 ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowSplitOffsets[0],
      properties.directional_shadow_split_2 ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowSplitOffsets[1],
      properties.directional_shadow_split_3 ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowSplitOffsets[2],
    ],
    blendSplits: properties.directional_shadow_blend_splits ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.blendSplits,
    sharesAtlas: sharesDirectionalShadowAtlas(properties.shadow_enabled, skyMode),
  };
}
