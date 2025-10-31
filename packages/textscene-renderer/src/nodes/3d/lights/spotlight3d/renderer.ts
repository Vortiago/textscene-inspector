/**
 * SpotLight3D renderer - renders SpotLight3D nodes using three.js.
 */

import * as THREE from 'three';
import type { SpotLight3DProperties } from './types';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../../../../utils/lightConstants';
import { configureLightShadow } from '../../../../utils/shadowUtils';
import { createLightWithTarget, positionLightTarget } from '../../../../utils/lightTargetUtils';

/**
 * Create a three.js SpotLight for a SpotLight3D node.
 * Returns a Group containing the light and its target.
 */
export function createSpotLight3D(
  nodeName: string,
  properties: SpotLight3DProperties
): THREE.Group {
  const color = parseColorToHex(properties.light_color);

  const light = new THREE.SpotLight(color, properties.light_energy * LIGHT_INTENSITY_SCALE);
  light.name = nodeName;
  light.distance = properties.spot_range;
  light.angle = (properties.spot_angle * Math.PI) / 180;
  light.penumbra = properties.penumbra !== undefined ? properties.penumbra : 0.1;
  light.decay = 2; // Physically accurate falloff

  if (properties.shadow_enabled) {
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = properties.spot_range;

    configureLightShadow(
      light,
      properties.shadow_bias,
      properties.shadow_filter,
      DEFAULT_SHADOW_BIAS.SPOT
    );
  }

  return createLightWithTarget(light, nodeName);
}

// Re-export the generic light target positioning function for backward compatibility
export { positionLightTarget as positionSpotLightTarget };
