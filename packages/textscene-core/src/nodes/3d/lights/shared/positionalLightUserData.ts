/** The `userData` of an omni or spot light: its shadow declaration and its part in the volumetric fog. */

import { useMemo } from 'react';
import { LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT } from '../../../../godot/volumetricFog';
import { fogLightUserData } from '../../../../r3f/fog/fogLightDeclaration';
import { usePositionalShadowUserData } from './positionalShadowDeclaration';
import type { PositionalLightProperties } from './types';

/** Rebuilt only when a property it reads changes. A spot passes its `spot_angle_attenuation`. */
export function usePositionalLightUserData(
  properties: PositionalLightProperties,
  spotAngleAttenuation?: number
): Record<string, unknown> {
  const shadowUserData = usePositionalShadowUserData(properties);
  const fogEnergy = properties.light_volumetric_fog_energy ?? LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT;
  return useMemo(
    () => ({ ...shadowUserData, ...fogLightUserData({ energy: fogEnergy, spotAngleAttenuation }) }),
    [shadowUserData, fogEnergy, spotAngleAttenuation]
  );
}
