/**
 * <DirectionalLight3D> — parallel light source (sunlight) with optional shadow.
 * Wrapped in a transform group; light points at a target placed at local -Z.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DirectionalLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../../../../r3f/lightConstants';
import { LightWithTarget } from '../shared/lightShared';
import { DirectionalLightGizmo } from '../shared/lightHelpers';

const SHADOW_FRUSTUM_HALF = 20;

export function DirectionalLight3D({ node }: NodeComponentProps) {
  const properties = node.properties as DirectionalLight3DProperties;
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const shadowFar = properties.directional_shadow_max_distance ?? 100;
  const bias = properties.shadow_bias !== undefined
    ? -properties.shadow_bias * 0.01
    : DEFAULT_SHADOW_BIAS.DIRECTIONAL;

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
            shadow-bias={bias}
            shadow-camera-near={0.1}
            shadow-camera-far={shadowFar}
            shadow-camera-left={-SHADOW_FRUSTUM_HALF}
            shadow-camera-right={SHADOW_FRUSTUM_HALF}
            shadow-camera-top={SHADOW_FRUSTUM_HALF}
            shadow-camera-bottom={-SHADOW_FRUSTUM_HALF}
            target={target}
          />
          <DirectionalLightGizmo lightRef={lightRef} />
        </>
      )}
    />
  );
}
