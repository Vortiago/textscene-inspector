/**
 * The shadow an AreaLight3D declares to the scene's positional shadow fitter, with Godot's
 * AreaLight3D defaults.
 */

import {
  POSITIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  positionalSoftShadow,
} from '../../../../godot/positionalShadow';
import { SHADOW_BLUR_DEFAULT } from '../../../../godot/softShadowScale';
import type { PositionalShadowDeclaration } from '../../../../r3f/positionalShadow/declaration';
import { softShadowRadius } from '../../../../r3f/positionalShadow/softShadowRadius';
import type { AreaLight3DProperties } from './types';

type AreaShadowProperties = Pick<AreaLight3DProperties, 'light_size' | 'shadow_blur' | 'shadow_normal_bias'>;

export function areaShadowDeclaration(properties: AreaShadowProperties): PositionalShadowDeclaration {
  return {
    normalBias: properties.shadow_normal_bias ?? POSITIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
    softShadowRadius: softShadowRadius(
      positionalSoftShadow(properties.light_size, properties.shadow_blur ?? SHADOW_BLUR_DEFAULT)
    ),
  };
}
