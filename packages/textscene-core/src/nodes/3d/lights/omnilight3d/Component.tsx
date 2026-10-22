/**
 * <OmniLight3D>: a point light with attenuation, in a transform group so the
 * wireframe-sphere helper follows the light.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { OmniLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { positionalShadowNear } from '../../../../godot/rendering/lights/positionalShadow';
import { lightBufferRange } from '../../../../godot/rendering/lights/lightBufferRange';
import { omniShadowBias } from '../shared/shadowBias';
import { PointLightGizmo } from '../shared/lightHelpers';
import { usePositionalLight } from '../shared/positionalLight';

export function OmniLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as OmniLight3DProperties;
  const lightRef = useRef<THREE.PointLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  // The floored range, as the shader's falloff and shadow lookup read it: three takes 0 as no cutoff.
  const range = lightBufferRange(properties.omni_range);
  const { intensity, shadowOpacity, userData } = usePositionalLight(lightRef, properties);

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      <pointLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        distance={range}
        decay={properties.omni_attenuation}
        castShadow={properties.shadow_enabled}
        shadow-intensity={shadowOpacity}
        userData={userData}
        shadow-bias={omniShadowBias(properties.shadow_bias)}
        shadow-camera-near={positionalShadowNear(range)}
        shadow-camera-far={range}
      />
      <PointLightGizmo lightRef={lightRef} />
      {children}
    </group>
  );
}
