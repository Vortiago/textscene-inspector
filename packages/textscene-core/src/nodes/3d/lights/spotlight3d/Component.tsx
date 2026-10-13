/**
 * <SpotLight3D>: a cone light aimed at a target. Its SpotLightHelper gizmo
 * shows the angle, range and aim without relying on the illumination.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { SpotLight3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { godotConePenumbra } from '../../../../r3f/godotLightAttenuation';
import { positionalShadowNear } from '../../../../godot/positionalShadow';
import { spotShadowBias } from '../shared/shadowBias';
import { LightWithTarget } from '../shared/lightShared';
import { SpotLightGizmo } from '../shared/lightHelpers';
import { usePositionalLight } from '../shared/positionalLight';

export function SpotLight3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as SpotLight3DProperties;
  const lightRef = useRef<THREE.SpotLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const angleRadians = (properties.spot_angle * Math.PI) / 180;
  // `spot_attenuation` is Godot's distance falloff exponent, which three calls decay.
  const decay = properties.spot_attenuation;
  const penumbra = godotConePenumbra(angleRadians, properties.spot_angle_attenuation);
  const { intensity, shadowOpacity, userData } = usePositionalLight(
    lightRef,
    properties,
    properties.spot_angle_attenuation
  );

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
            shadow-intensity={shadowOpacity}
            userData={userData}
            shadow-bias={spotShadowBias(properties.shadow_bias, properties.shadow_blur)}
            shadow-camera-near={positionalShadowNear(properties.spot_range)}
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
