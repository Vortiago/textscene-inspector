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
import {
  LIGHT_INTENSITY_SCALE,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS,
} from '../../../../r3f/lightConstants';
import { omniShadowBias } from '../shared/shadowBias';
import { PointLightGizmo } from '../shared/lightHelpers';

/** three's cube shadow camera needs a positive near; Godot's omni pass has none. */
const SHADOW_NEAR = 0.5;

export function OmniLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as OmniLight3DProperties;
  const lightRef = useRef<THREE.PointLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const bias = omniShadowBias(properties.shadow_bias, SHADOW_NEAR, properties.omni_range);

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      <pointLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        distance={properties.omni_range}
        decay={properties.omni_attenuation}
        castShadow={properties.shadow_enabled}
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
        shadow-bias={bias}
        shadow-normalBias={SHADOW_NORMAL_BIAS}
        shadow-camera-near={SHADOW_NEAR}
        shadow-camera-far={properties.omni_range}
      />
      <PointLightGizmo lightRef={lightRef} />
      {children}
    </group>
  );
}
