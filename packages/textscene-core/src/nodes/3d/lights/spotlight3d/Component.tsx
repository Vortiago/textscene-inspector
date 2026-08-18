/**
 * <SpotLight3D> — cone-shaped light with target for direction.
 * Gizmo: three.js SpotLightHelper draws the cone outline so users can
 * see the angle / range / aim without depending on visible illumination.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { SpotLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import {
  LIGHT_INTENSITY_SCALE,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS,
} from '../../../../r3f/lightConstants';
import { spotShadowBias } from '../shared/shadowBias';
import { LightWithTarget } from '../shared/lightShared';
import { SpotLightGizmo } from '../shared/lightHelpers';

export function SpotLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as SpotLight3DProperties;
  const lightRef = useRef<THREE.SpotLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const angleRadians = (properties.spot_angle * Math.PI) / 180;
  // Godot `spot_attenuation` is the DISTANCE falloff exponent (default 1) →
  // three.js decay (was hardcoded to 2, dimming lights too fast).
  // `spot_angle_attenuation` is the CONE-EDGE falloff exponent (default 1;
  // higher = sharper edge) → three.js penumbra (0 hard .. 1 soft), mapped
  // inversely. Explicit `penumbra` overrides the derived value.
  const decay = properties.spot_attenuation ?? 1;
  const penumbra =
    properties.penumbra ??
    Math.max(0, Math.min(1, 1 / ((properties.spot_angle_attenuation ?? 1) + 1)));
  const bias = spotShadowBias(properties.shadow_bias, properties.shadow_blur, properties.spot_range);

  return (
    <LightWithTarget
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      renderLight={(target) => (
        <>
          <spotLight
            ref={lightRef}
            position={[0, 0, 0]}
            color={color}
            intensity={intensity}
            distance={properties.spot_range}
            angle={angleRadians}
            penumbra={penumbra}
            decay={decay}
            castShadow={properties.shadow_enabled}
            shadow-mapSize-width={SHADOW_MAP_SIZE}
            shadow-mapSize-height={SHADOW_MAP_SIZE}
            shadow-bias={bias}
            shadow-normalBias={SHADOW_NORMAL_BIAS}
            shadow-camera-near={0.5}
            shadow-camera-far={properties.spot_range}
            target={target}
          />
          <SpotLightGizmo lightRef={lightRef} />
        </>
      )}
    >
      {children}
    </LightWithTarget>
  );
}
