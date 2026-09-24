/**
 * <DirectionalLight3D>: a parallel light with optional shadow, in a transform
 * group, aimed at a target at local -Z.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DirectionalLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import {
  LIGHT_INTENSITY_SCALE,
  DIRECTIONAL_SHADOW_FRUSTUM_HALF,
  DIRECTIONAL_SHADOW_NEAR,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS,
} from '../../../../r3f/lightConstants';
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
  const shadowFar = properties.directional_shadow_max_distance ?? 100;
  const bias = directionalShadowBias(properties.shadow_bias, properties.shadow_blur);

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
            shadow-mapSize-width={SHADOW_MAP_SIZE}
            shadow-mapSize-height={SHADOW_MAP_SIZE}
            shadow-bias={bias}
            shadow-normalBias={SHADOW_NORMAL_BIAS}
            shadow-camera-near={DIRECTIONAL_SHADOW_NEAR}
            shadow-camera-far={shadowFar}
            shadow-camera-left={-DIRECTIONAL_SHADOW_FRUSTUM_HALF}
            shadow-camera-right={DIRECTIONAL_SHADOW_FRUSTUM_HALF}
            shadow-camera-top={DIRECTIONAL_SHADOW_FRUSTUM_HALF}
            shadow-camera-bottom={-DIRECTIONAL_SHADOW_FRUSTUM_HALF}
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
