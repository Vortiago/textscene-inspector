/**
 * <AreaLight3D>: a three.js RectAreaLight sized from `area_size`, which the patched chunks shade
 * with Godot's area light (`r3f/areaLight/`). It carries its range, attenuation and specular to the
 * shader, and casts no shadow yet.
 */

import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { AreaLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { areaLightUserData, observeAreaLight } from '../../../../r3f/areaLight/areaLightFalloff';

/**
 * Godot's colour scale: `energy * PI`, negated for a negative light, divided by the rectangle's
 * area when the light normalises its energy (4.7.2: `light_storage.cpp:1003`, `:1046`, `:1094-1100`).
 */
function areaLightIntensity(properties: AreaLight3DProperties): number {
  const { x: width, y: height } = properties.area_size;
  const area = width * height;
  const sign = properties.light_negative ? -1 : 1;
  const intensity = sign * properties.light_energy * LIGHT_INTENSITY_SCALE;
  return properties.area_normalize_energy && area > 0 ? intensity / area : intensity;
}

export function AreaLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as AreaLight3DProperties;
  const lightRef = useRef<THREE.RectAreaLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const userData = useMemo(
    () =>
      areaLightUserData({
        range: properties.area_range,
        attenuation: properties.area_attenuation,
        specular: properties.light_specular,
      }),
    [properties.area_range, properties.area_attenuation, properties.light_specular]
  );
  useEffect(() => observeAreaLight(lightRef.current!), []);

  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={properties.visible !== false}
    >
      <rectAreaLight
        ref={lightRef}
        color={parseColorToHex(properties.light_color)}
        intensity={areaLightIntensity(properties)}
        width={properties.area_size.x}
        height={properties.area_size.y}
        userData={userData}
      />
      {children}
    </group>
  );
}
