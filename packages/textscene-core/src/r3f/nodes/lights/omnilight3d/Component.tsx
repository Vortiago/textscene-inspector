/**
 * <OmniLight3D> — Godot omnidirectional point light. Emits in all directions
 * with attenuation; no target required.
 */

import { useMemo } from 'react';
import type { OmniLight3DProperties } from '../../../../nodes/3d/lights/omnilight3d/types';
import type { NodeComponentProps } from '../../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../../../../utils/lightConstants';

export function OmniLight3D({ node }: NodeComponentProps) {
  const properties = node.properties as OmniLight3DProperties;
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
    <pointLight
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      color={color}
      intensity={intensity}
      distance={properties.omni_range}
      decay={properties.omni_attenuation}
      castShadow={properties.shadow_enabled}
      shadow-bias={bias}
      shadow-camera-near={0.5}
      shadow-camera-far={properties.omni_range}
    />
  );
}
