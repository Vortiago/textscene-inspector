/**
 * <DirectionalLight3D>: a parallel light in a transform group, aimed at a target at local -Z. It
 * declares its shadow to the scene's `<SceneShadowFitter>` and its sun to the sky, by
 * `sky_mode` (`r3f/directionalShadow/directionalShadow.md`).
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DirectionalLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import {
  DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT,
  directionalLightDrawsInSky,
  directionalLightLightsSurfaces,
} from '../../../../godot/directionalLightSkyMode';
import { directionalShadowUserData } from '../../../../r3f/directionalShadow/declaration';
import { skyLightUserData } from '../../../../r3f/sky/skyLight';
import { directionalShadowDeclaration } from './shadowDeclaration';
import { LightWithTarget } from '../shared/lightShared';
import { DirectionalLightGizmo } from '../shared/lightHelpers';
import {
  directionalLightSpecularAmount,
  lightFogEnergy,
  lightIntensity,
  lightShadowOpacity,
  signedLightEnergy,
} from '../shared/lightStrength';
import { lightSpecularUserData } from '../../../../r3f/lightSpecular/lightSpecular';
import { lightSizeUserData } from '../../../../r3f/lightSize/lightSize';
import {
  directionalLightSize,
  LIGHT_ANGULAR_DISTANCE_DEFAULT,
} from '../../../../godot/directionalSoftShadow';
import { fogLightUserData } from '../../../../r3f/fog/fogLightDeclaration';

export function DirectionalLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as DirectionalLight3DProperties;
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const skyMode = properties.sky_mode ?? DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT;
  // A Sky Only light lights no surface. It keeps its energy for the sky, which reads it from `userData`.
  const intensity = directionalLightLightsSurfaces(skyMode) ? lightIntensity(properties) : 0;
  const skyEnergy = signedLightEnergy(properties);
  const shadow = useMemo(() => directionalShadowDeclaration(properties), [properties]);
  const fogEnergy = lightFogEnergy(properties);
  const specularAmount = directionalLightSpecularAmount(properties);
  const size = directionalLightSize(properties.light_angular_distance ?? LIGHT_ANGULAR_DISTANCE_DEFAULT);
  const userData = useMemo(
    () => ({
      ...skyLightUserData({
        drawsInSky: directionalLightDrawsInSky(skyMode),
        energy: skyEnergy,
      }),
      ...directionalShadowUserData(shadow),
      ...fogLightUserData({ energy: fogEnergy }),
      ...lightSpecularUserData(specularAmount),
      ...lightSizeUserData(size),
    }),
    [skyMode, skyEnergy, shadow, fogEnergy, specularAmount, size]
  );

  return (
    <LightWithTarget
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      renderLight={(target) => (
        <>
          <directionalLight
            ref={lightRef}
            position={[0, 0, 0]}
            color={color}
            intensity={intensity}
            // A mode with no split casts nothing, as Godot sets up no shadow map for it.
            castShadow={shadow.sharesAtlas && shadow.splitCount > 0}
            shadow-intensity={lightShadowOpacity(properties)}
            userData={userData}
            target={target}
          />
          <DirectionalLightGizmo lightRef={lightRef} />
        </>
      )}
    >
      {children}
    </LightWithTarget>
  );
}
