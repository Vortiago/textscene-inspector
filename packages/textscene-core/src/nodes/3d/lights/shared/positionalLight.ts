/** What an omni or spot light draws with: its intensity, shadow opacity and `userData`, faded by distance. */

import { useMemo, type RefObject } from 'react';
import type * as THREE from 'three';
import { fogLightUserData } from '../../../../r3f/fog/fogLightDeclaration';
import { useLightDistanceFade } from './lightDistanceFade';
import {
  lightFogEnergy,
  lightIntensity,
  lightShadowOpacity,
  positionalLightSpecularAmount,
} from './lightStrength';
import { lightSpecularUserData } from '../../../../r3f/lightSpecular/lightSpecular';
import { usePositionalShadowUserData } from './positionalShadowDeclaration';
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
  const intensity = lightIntensity(properties);
  const shadowOpacity = lightShadowOpacity(properties);
  useLightDistanceFade(lightRef, properties, { intensity, shadowOpacity });
  const shadowUserData = usePositionalShadowUserData(properties);
  const fogEnergy = lightFogEnergy(properties);
  const specularAmount = positionalLightSpecularAmount(properties);
  const userData = useMemo(
    () => ({
      ...shadowUserData,
      ...fogLightUserData({ energy: fogEnergy, spotAngleAttenuation }),
      ...lightSpecularUserData(specularAmount),
    }),
    [shadowUserData, fogEnergy, spotAngleAttenuation, specularAmount]
  );
  return { intensity, shadowOpacity, userData };
}
