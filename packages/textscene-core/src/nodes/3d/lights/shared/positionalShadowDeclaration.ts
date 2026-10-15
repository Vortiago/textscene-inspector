/**
 * The shadow an OmniLight3D or SpotLight3D declares to the scene's positional shadow fitter, with
 * Godot's class default for each property it leaves out.
 */

import { useMemo } from 'react';
import { LIGHT_SHADOW_NORMAL_BIAS_DEFAULT, LIGHT_SIZE_DEFAULT } from '../../../../godot/light';
import { positionalSoftShadow } from '../../../../godot/positionalShadow';
import { SHADOW_BLUR_DEFAULT } from '../../../../godot/softShadowScale';
import {
  positionalShadowUserData,
  type PositionalShadowDeclaration,
} from '../../../../r3f/positionalShadow/declaration';
import { softShadowRadius } from '../../../../r3f/positionalShadow/softShadowRadius';
import type { PositionalLightProperties } from './types';

/** The properties an omni or spot light's shadow declaration reads. */
type PositionalShadowProperties = Pick<
  PositionalLightProperties,
  'shadow_normal_bias' | 'shadow_blur' | 'light_size'
>;

export function positionalShadowDeclaration(
  properties: PositionalShadowProperties
): PositionalShadowDeclaration {
  const softShadow = positionalSoftShadow(
    properties.light_size ?? LIGHT_SIZE_DEFAULT,
    properties.shadow_blur ?? SHADOW_BLUR_DEFAULT
  );
  return {
    normalBias: properties.shadow_normal_bias ?? LIGHT_SHADOW_NORMAL_BIAS_DEFAULT,
    softShadowRadius: softShadowRadius(softShadow),
  };
}

/** The light's `userData`, rebuilt only when a property the declaration reads changes. */
export function usePositionalShadowUserData({
  shadow_normal_bias,
  shadow_blur,
  light_size,
}: PositionalShadowProperties): Record<string, unknown> {
  return useMemo(
    () =>
      positionalShadowUserData(positionalShadowDeclaration({ shadow_normal_bias, shadow_blur, light_size })),
    [shadow_normal_bias, shadow_blur, light_size]
  );
}
