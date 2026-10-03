/**
 * The shadow an OmniLight3D or SpotLight3D declares to the scene's positional shadow fitter, with
 * Godot's class default for each property it leaves out.
 */

import { useMemo } from 'react';
import { POSITIONAL_SHADOW_NORMAL_BIAS_DEFAULT } from '../../../../godot/positionalShadow';
import { softShadowScale } from '../../../../godot/softShadowScale';
import {
  positionalShadowUserData,
  type PositionalShadowDeclaration,
} from '../../../../r3f/positionalShadow/declaration';
import type { BaseLightWithNormalBias } from './types';

/** The properties an omni or spot light's shadow declaration reads. */
type PositionalShadowProperties = Pick<BaseLightWithNormalBias, 'shadow_normal_bias' | 'shadow_blur'>;

export function positionalShadowDeclaration(
  properties: PositionalShadowProperties
): PositionalShadowDeclaration {
  return {
    normalBias: properties.shadow_normal_bias ?? POSITIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
    softShadowScale: softShadowScale(properties.shadow_blur),
  };
}

/** The light's `userData`, rebuilt only when a property the declaration reads changes. */
export function usePositionalShadowUserData({
  shadow_normal_bias,
  shadow_blur,
}: PositionalShadowProperties): Record<string, unknown> {
  return useMemo(
    () => positionalShadowUserData(positionalShadowDeclaration({ shadow_normal_bias, shadow_blur })),
    [shadow_normal_bias, shadow_blur]
  );
}
