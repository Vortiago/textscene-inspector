/**
 * <DirectionalLight3D>: a parallel light with optional shadow, in a transform
 * group, aimed at a target at local -Z. It declares its shadow parameters and
 * leaves the shadow box to the scene's `<DirectionalShadowFitter>`, as Godot
 * fits a directional shadow to the camera and not to the light.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DirectionalLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import {
  DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT,
  DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
} from '../../../../godot/directionalShadow';
import { directionalShadowUserData } from '../../../../r3f/directionalShadow/declaration';
import { directionalShadowBias } from '../shared/shadowBias';
import { LightWithTarget } from '../shared/lightShared';
import { DirectionalLightGizmo } from '../shared/lightHelpers';


export function DirectionalLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as DirectionalLight3DProperties;
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const shadowUserData = useMemo(
    () =>
      directionalShadowUserData({
        maxDistance:
          properties.directional_shadow_max_distance ?? DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT,
        pancakeSize:
          properties.directional_shadow_pancake_size ?? DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
        depthBias: directionalShadowBias(properties.shadow_bias, properties.shadow_blur),
        normalBias: properties.shadow_normal_bias ?? DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
      }),
    [properties]
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
            castShadow={properties.shadow_enabled}
            shadow-mapSize-width={DIRECTIONAL_SHADOW_SIZE_DEFAULT}
            shadow-mapSize-height={DIRECTIONAL_SHADOW_SIZE_DEFAULT}
            userData={shadowUserData}
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
