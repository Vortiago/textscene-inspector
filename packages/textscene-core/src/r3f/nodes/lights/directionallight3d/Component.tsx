/**
 * <DirectionalLight3D> — parallel light source (sunlight) with optional shadow.
 * Wrapped in a transform group; light points at a target placed at local -Z.
 */

import { useMemo } from 'react';
import type { DirectionalLight3DProperties } from '../../../../nodes/3d/lights/directionallight3d/types';
import type { NodeComponentProps } from '../../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../nodeTransform';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../../../../utils/lightConstants';
import { LightWithTarget } from '../lightShared';

const SHADOW_FRUSTUM_HALF = 20;

export function DirectionalLight3D({ node }: NodeComponentProps) {
  const properties = node.properties as DirectionalLight3DProperties;
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
        <directionalLight
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
      )}
    />
  );
}
