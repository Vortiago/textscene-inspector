/**
 * DirectionalLight3D renderer - renders DirectionalLight3D nodes using three.js.
 */

import * as THREE from 'three';
import type { DirectionalLight3DProperties } from './types';
import { parseColorToHex } from '../../../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../../../../utils/lightConstants';
import { configureLightShadow } from '../../../../utils/shadowUtils';
import { createLightWithTarget, positionLightTarget } from '../../../../utils/lightTargetUtils';

/**
 * Create a three.js DirectionalLight for a DirectionalLight3D node.
 * Returns a Group containing the light and its target.
 */
export function createDirectionalLight3D(
  nodeName: string,
  properties: DirectionalLight3DProperties
): THREE.Group {
  const color = parseColorToHex(properties.light_color);

  const light = new THREE.DirectionalLight(color, properties.light_energy * LIGHT_INTENSITY_SCALE);
  light.name = nodeName;

  if (properties.shadow_enabled) {
    // Orthographic shadow camera frustum
    const frustumSize = 20;
    light.shadow.camera.left = -frustumSize;
    light.shadow.camera.right = frustumSize;
    light.shadow.camera.top = frustumSize;
    light.shadow.camera.bottom = -frustumSize;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = properties.directional_shadow_max_distance || 100;

    configureLightShadow(
      light,
      properties.shadow_bias,
      properties.shadow_filter,
      DEFAULT_SHADOW_BIAS.DIRECTIONAL
    );
  }

  return createLightWithTarget(light, nodeName);
}

// Re-export the generic light target positioning function for backward compatibility
export { positionLightTarget as positionDirectionalLightTarget };
