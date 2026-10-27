/** What an omni or spot light draws with: its intensity, shadow opacity and `userData`, faded by distance. */

import { useMemo, type RefObject } from 'react';
import { visualLayersUserData } from '../../../../r3f/visualLayers';
import type * as THREE from 'three';
import { fogLightUserData } from '../../../../r3f/fog/fogLightDeclaration';
import { useLightDistanceFade } from './lightDistanceFade';
import {
  lightFogEnergy,
  lightShadowOpacity,
  positionalLightSpecularAmount,
  useLightIntensity,
} from './lightStrength';
import { lightSpecularUserData } from '../../../../r3f/lightSpecular/lightSpecular';
import { lightBakeModeUserData } from '../../../../r3f/lightBakeMode/lightBakeMode';
import { lightSizeUserData } from '../../../../r3f/lightSize/lightSize';
import { LIGHT_3D_DEFAULTS } from '../../../../godot/scene/light';
import { usePositionalShadowUserData } from './positionalShadowDeclaration';
import { positionalShadowNear } from '../../../../godot/rendering/lights/positionalShadow';
import { lightBufferRange } from '../../../../godot/rendering/lights/lightBufferRange';
import type { PositionalLightProperties } from './types';

interface PositionalLight {
  intensity: number;
  shadowOpacity: number;
  userData: Record<string, unknown>;
}

/**
 * The light in `lightRef` as `properties` set it, with its distance fade installed. A spot passes
 * its `spot_angle_attenuation`. The `userData` is rebuilt only when a property it reads changes.
 */
export function usePositionalLight(
  lightRef: RefObject<THREE.PointLight | THREE.SpotLight | null>,
  properties: PositionalLightProperties,
  spotAngleAttenuation?: number
): PositionalLight {
  const intensity = useLightIntensity(properties);
  const shadowOpacity = lightShadowOpacity(properties);
  useLightDistanceFade(lightRef, properties, { intensity, shadowOpacity });
  const shadowUserData = usePositionalShadowUserData(properties);
  const fogEnergy = lightFogEnergy(properties);
  const specularAmount = positionalLightSpecularAmount(properties);
  const size = properties.light_size ?? LIGHT_3D_DEFAULTS.size;
  const userData = useMemo(
    () => ({
      ...shadowUserData,
      ...fogLightUserData({ energy: fogEnergy, spotAngleAttenuation }),
      ...lightSpecularUserData(specularAmount),
      ...lightSizeUserData(size),
      ...lightBakeModeUserData(properties.light_bake_mode),
      ...visualLayersUserData(properties.layers),
    }),
    [
      shadowUserData,
      fogEnergy,
      spotAngleAttenuation,
      specularAmount,
      size,
      properties.light_bake_mode,
      properties.layers,
    ]
  );
  return { intensity, shadowOpacity, userData };
}

/**
 * The reach and shadow camera planes of an omni or spot light of range `range`. The range is floored
 * as the shader's falloff and shadow lookup read it, since three takes a distance of 0 as no cutoff.
 */
export function positionalLightRange(range: number): {
  distance: number;
  shadowNear: number;
  shadowFar: number;
} {
  const distance = lightBufferRange(range);
  return { distance, shadowNear: positionalShadowNear(distance), shadowFar: distance };
}
