/**
 * <SpotLight3D> — cone-shaped light with target for direction.
 * Gizmo: three.js SpotLightHelper draws the cone outline so users can
 * see the angle / range / aim without depending on visible illumination.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { SpotLight3DProperties } from '../../../../nodes/3d/lights/spotlight3d/types';
import type { NodeComponentProps } from '../../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../../../../utils/lightConstants';
import { LightWithTarget } from '../lightShared';
import { SpotLightGizmo } from '../lightHelpers';

export function SpotLight3D({ node }: NodeComponentProps) {
  const properties = node.properties as SpotLight3DProperties;
  const lightRef = useRef<THREE.SpotLight | null>(null);
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );
  const color = parseColorToHex(properties.light_color);
  const intensity = properties.light_energy * LIGHT_INTENSITY_SCALE;
  const angleRadians = (properties.spot_angle * Math.PI) / 180;
  const penumbra = properties.penumbra ?? 0.1;
  const bias = properties.shadow_bias !== undefined
    ? -properties.shadow_bias * 0.01
    : DEFAULT_SHADOW_BIAS.SPOT;

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
            color={color}
            intensity={intensity}
            distance={properties.spot_range}
            angle={angleRadians}
            penumbra={penumbra}
            decay={2}
            castShadow={properties.shadow_enabled}
            shadow-bias={bias}
            shadow-camera-near={0.5}
            shadow-camera-far={properties.spot_range}
            target={target}
          />
          <SpotLightGizmo lightRef={lightRef} />
        </>
      )}
    />
  );
}
