/**
 * <AreaLight3D>: a three.js RectAreaLight sized from `area_size`, which the patched chunks shade
 * with Godot's area light (`r3f/areaLight/`). It carries its range, attenuation and specular to the
 * shader and its fog energy to the volumetric fog, fades by the camera's distance, and casts no
 * shadow yet.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { AreaLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { lightIntensity, lightShadowOpacity } from '../shared/lightStrength';
import { useLightDistanceFade } from '../shared/lightDistanceFade';
import { areaLightUserData } from '../../../../r3f/areaLight/areaLightFalloff';
import { fogLightUserData } from '../../../../r3f/fog/fogLightDeclaration';
import { LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT } from '../../../../godot/volumetricFog';

/**
 * Godot's colour scale: `energy * PI`, negated for a negative light, divided by the rectangle's
 * area when the light normalises its energy (4.7.2: `light_storage.cpp:1003`, `:1046`, `:1094-1100`).
 */
function areaLightIntensity(properties: AreaLight3DProperties): number {
  const { x: width, y: height } = properties.area_size;
  const area = width * height;
  const intensity = lightIntensity(properties);
  return properties.area_normalize_energy && area > 0 ? intensity / area : intensity;
}

export function AreaLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as AreaLight3DProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const lightRef = useRef<THREE.RectAreaLight>(null);
  const intensity = areaLightIntensity(properties);
  useLightDistanceFade(lightRef, properties, { intensity, shadowOpacity: lightShadowOpacity(properties) });
  const fogEnergy = properties.light_volumetric_fog_energy ?? LIGHT_VOLUMETRIC_FOG_ENERGY_DEFAULT;
  const userData = useMemo(
    () => ({
      ...areaLightUserData({
        range: properties.area_range,
        attenuation: properties.area_attenuation,
        specular: properties.light_specular,
      }),
      ...fogLightUserData({ energy: fogEnergy }),
    }),
    [properties.area_range, properties.area_attenuation, properties.light_specular, fogEnergy]
  );

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      <rectAreaLight
        ref={lightRef}
        color={parseColorToHex(properties.light_color)}
        intensity={intensity}
        width={properties.area_size.x}
        height={properties.area_size.y}
        userData={userData}
      />
      {children}
    </group>
  );
}
