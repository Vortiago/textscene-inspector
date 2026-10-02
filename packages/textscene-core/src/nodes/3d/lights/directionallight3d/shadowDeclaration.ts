/**
 * The shadow a DirectionalLight3D declares to the scene's shadow fitter, with Godot's class default
 * for each property it leaves out. The editor's preview sun declares through this too, so the two
 * suns cannot drift apart.
 */

import {
  DIRECTIONAL_SHADOW_BLEND_SPLITS_DEFAULT,
  DIRECTIONAL_SHADOW_FADE_START_DEFAULT,
  DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT,
  DIRECTIONAL_SHADOW_MODE_DEFAULT,
  DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
  DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT,
  directionalShadowSplitCount,
  sharesDirectionalShadowAtlas,
} from '../../../../godot/directionalShadow';
import { DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT } from '../../../../godot/directionalLightSkyMode';
import { softShadowScale } from '../../../../godot/softShadowScale';
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
  return {
    maxDistance: properties.directional_shadow_max_distance ?? DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT,
    pancakeSize: properties.directional_shadow_pancake_size ?? DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
    fadeStart: properties.directional_shadow_fade_start ?? DIRECTIONAL_SHADOW_FADE_START_DEFAULT,
    depthBias: directionalShadowBias(properties.shadow_bias, properties.shadow_blur),
    normalBias: properties.shadow_normal_bias ?? DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
    filterRadius: softShadowScale(properties.shadow_blur),
    splitCount: directionalShadowSplitCount(
      properties.directional_shadow_mode ?? DIRECTIONAL_SHADOW_MODE_DEFAULT
    ),
    splitOffsets: [
      properties.directional_shadow_split_1 ?? DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT[0],
      properties.directional_shadow_split_2 ?? DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT[1],
      properties.directional_shadow_split_3 ?? DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT[2],
    ],
    blendSplits: properties.directional_shadow_blend_splits ?? DIRECTIONAL_SHADOW_BLEND_SPLITS_DEFAULT,
    sharesAtlas: sharesDirectionalShadowAtlas(
      properties.shadow_enabled,
      properties.sky_mode ?? DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT
    ),
  };
}
