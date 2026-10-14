/**
 * <AreaLight3D>: a three.js RectAreaLight sized from `area_size`, which the patched chunks shade
 * with Godot's area light (`r3f/areaLight/`). It carries its range, attenuation, specular and
 * `area_texture` to the shader and its fog energy to the volumetric fog, and casts its shadow
 * through the positional shadow atlas (`AtlasAreaShadow`).
 */

import { useEffect, useMemo, useRef } from 'react';
import { visualLayersUserData } from '../../../../r3f/visualLayers';
import type * as THREE from 'three';
import type { AreaLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { lightFogEnergy, lightIntensity, lightShadowOpacity } from '../shared/lightStrength';
import { useLightDistanceFade } from '../shared/lightDistanceFade';
import { areaLightUserData } from '../../../../r3f/areaLight/areaLightFalloff';
import { fogLightUserData } from '../../../../r3f/fog/fogLightDeclaration';
import { positionalShadowUserData } from '../../../../r3f/positionalShadow/declaration';
import { AtlasAreaShadow, type AreaShadowLight } from '../../../../r3f/positionalShadow/atlasAreaShadow';
import { AREA_LIGHT_SHADOW_BIAS_DEFAULT } from '../../../../godot/areaLightShadow';
import { areaShadowDeclaration } from './areaLightShadow';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useTexture2DRid } from '../../../../resources/useTexture2D';
import {
  areaTextureUserData,
  holdAreaTexture,
  releaseAreaTexture,
} from '../../../../r3f/areaLight/areaLightAtlas';

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

/** The `area_texture`, held in the area light atlas while the light shows it. */
function useAreaTexture(ref: string | undefined): THREE.Texture | null {
  const { externalResources, internalResources } = useSceneResources();
  const { texture } = useTexture2DRid(ref, externalResources, internalResources);
  useEffect(() => {
    if (!texture) return;
    holdAreaTexture(texture);
    return () => releaseAreaTexture(texture);
  }, [texture]);
  return texture;
}

/**
 * The falloff and texture the shader reads, the shadow the fitter reads and the energy the fog
 * reads, rebuilt only when one of them changes.
 */
function useAreaLightUserData(properties: AreaLight3DProperties): Record<string, unknown> {
  const {
    layers,
    area_range,
    area_attenuation,
    light_specular,
    light_size,
    shadow_blur,
    shadow_normal_bias,
  } = properties;
  const texture = useAreaTexture(properties.area_texture);
  const fogEnergy = lightFogEnergy(properties);
  return useMemo(
    () => ({
      ...areaLightUserData({ range: area_range, attenuation: area_attenuation, specular: light_specular }),
      ...areaTextureUserData(texture),
      ...positionalShadowUserData(areaShadowDeclaration({ light_size, shadow_blur, shadow_normal_bias })),
      ...fogLightUserData({ energy: fogEnergy }),
      ...visualLayersUserData(layers),
    }),
    [
      layers,
      area_range,
      area_attenuation,
      light_specular,
      texture,
      light_size,
      shadow_blur,
      shadow_normal_bias,
      fogEnergy,
    ]
  );
}

export function AreaLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as AreaLight3DProperties;
  const lightRef = useRef<AreaShadowLight | null>(null);
  const shadow = useMemo(() => new AtlasAreaShadow(), []);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const intensity = areaLightIntensity(properties);
  const shadowOpacity = lightShadowOpacity(properties);
  useLightDistanceFade(lightRef, properties, { intensity, shadowOpacity });
  const userData = useAreaLightUserData(properties);

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      <rectAreaLight
        ref={lightRef}
        color={parseColorToHex(properties.light_color)}
        intensity={intensity}
        width={properties.area_size.x}
        height={properties.area_size.y}
        castShadow={properties.shadow_enabled}
        userData={userData}
      >
        <primitive
          object={shadow}
          attach="shadow"
          intensity={shadowOpacity}
          bias={properties.shadow_bias ?? AREA_LIGHT_SHADOW_BIAS_DEFAULT}
          range={properties.area_range}
          size={[properties.area_size.x, properties.area_size.y]}
        />
      </rectAreaLight>
      {children}
    </group>
  );
}
