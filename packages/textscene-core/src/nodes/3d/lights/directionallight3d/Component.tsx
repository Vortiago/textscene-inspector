/**
 * <DirectionalLight3D>: a parallel light in a transform group, aimed at a target at local -Z. It
 * declares its shadow to the scene's `<SceneShadowFitter>` and its sun to the sky, by
 * `sky_mode` (`r3f/directionalShadow/directionalShadow.md`).
 */

import { useMemo, useRef } from 'react';
import { visualLayersUserData } from '../../../../r3f/visualLayers';
import * as THREE from 'three';
import type { DirectionalLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { DIRECTIONAL_LIGHT_3D_DEFAULTS } from '../../../../godot/scene/light';
import {
  directionalLightDrawsInSky,
  directionalLightLightsSurfaces,
} from '../../../../godot/rendering/lights/directionalLightSkyMode';
import { directionalShadowUserData } from '../../../../r3f/directionalShadow/declaration';
import { skyLightUserData } from '../../../../r3f/sky/skyLight';
import { directionalShadowDeclaration } from './shadowDeclaration';
import { LightWithTarget } from '../shared/lightShared';
import { DirectionalLightGizmo } from '../shared/lightHelpers';
import {
  directionalLightSpecularAmount,
  lightFogEnergy,
  lightShadowOpacity,
  signedLightEnergy,
  useLightIntensity,
} from '../shared/lightStrength';
import { lightSpecularUserData } from '../../../../r3f/lightSpecular/lightSpecular';
import { lightBakeModeUserData } from '../../../../r3f/lightBakeMode/lightBakeMode';
import { lightSizeUserData } from '../../../../r3f/lightSize/lightSize';
import { directionalLightSize } from '../../../../godot/rendering/lights/directionalSoftShadow';
import { degToRad } from '../../../../godot/math/math';
import { fogLightUserData } from '../../../../r3f/fog/fogLightDeclaration';

export function DirectionalLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as DirectionalLight3DProperties;
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const skyMode = properties.sky_mode ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.skyMode;
  // A Sky Only light lights no surface. It keeps its energy for the sky, which reads it from `userData`.
  const exposedIntensity = useLightIntensity(properties);
  const intensity = directionalLightLightsSurfaces(skyMode) ? exposedIntensity : 0;
  const skyEnergy = signedLightEnergy(properties);
  const shadow = useMemo(() => directionalShadowDeclaration(properties), [properties]);
  const fogEnergy = lightFogEnergy(properties);
  const specularAmount = directionalLightSpecularAmount(properties);
  const angularDistance = properties.light_angular_distance ?? DIRECTIONAL_LIGHT_3D_DEFAULTS.size;
  const size = directionalLightSize(angularDistance);
  // `sky.cpp:1096-1097`: the sky reads LIGHT_PARAM_SIZE as an angle in radians.
  const skySize = degToRad(angularDistance);
  const userData = useMemo(
    () => ({
      ...skyLightUserData({
        drawsInSky: directionalLightDrawsInSky(skyMode),
        energy: skyEnergy,
        size: skySize,
      }),
      ...directionalShadowUserData(shadow),
      ...fogLightUserData({ energy: fogEnergy }),
      ...lightSpecularUserData(specularAmount),
      ...lightSizeUserData(size),
      ...lightBakeModeUserData(properties.light_bake_mode),
      ...visualLayersUserData(properties.layers),
    }),
    [
      skyMode,
      skyEnergy,
      skySize,
      shadow,
      fogEnergy,
      specularAmount,
      size,
      properties.light_bake_mode,
      properties.layers,
    ]
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
