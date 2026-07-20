/**
 * <OmniLight3D> — Godot omnidirectional point light. Emits in all directions
 * with attenuation; no target required. Wrapped in a transform group so the
 * helper gizmo (a wireframe sphere) follows the light.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { OmniLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../../../../r3f/lightConstants';
import { PointLightGizmo } from '../shared/lightHelpers';

export function OmniLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as OmniLight3DProperties;
  const lightRef = useRef<THREE.PointLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const bias = properties.shadow_bias !== undefined
    ? -properties.shadow_bias * 0.01
    : DEFAULT_SHADOW_BIAS.OMNI;

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      <pointLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        distance={properties.omni_range}
        decay={properties.omni_attenuation}
        castShadow={properties.shadow_enabled}
        shadow-bias={bias}
        shadow-camera-near={0.5}
        shadow-camera-far={properties.omni_range}
      />
      <PointLightGizmo lightRef={lightRef} />
      {children}
    </group>
  );
}
