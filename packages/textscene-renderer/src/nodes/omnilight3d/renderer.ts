/**
 * OmniLight3D renderer - renders OmniLight3D nodes using three.js.
 */

import * as THREE from 'three';
import type { OmniLight3DProperties } from './types';
import { parseColorToHex } from '../../utils/colorParser';
import { LIGHT_INTENSITY_SCALE, DEFAULT_SHADOW_BIAS } from '../../utils/lightConstants';
import { configureLightShadow } from '../../utils/shadowUtils';

/**
 * Create a three.js PointLight for an OmniLight3D node.
 * Returns a PointLight (no target needed since it emits in all directions).
 */
export function createOmniLight3D(
  nodeName: string,
  properties: OmniLight3DProperties
): THREE.PointLight {
  const color = parseColorToHex(properties.light_color);

  const light = new THREE.PointLight(
    color,
    properties.light_energy * LIGHT_INTENSITY_SCALE,
    properties.omni_range,
    properties.omni_attenuation
  );

  light.name = nodeName;

  if (properties.shadow_enabled) {
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = properties.omni_range;

    // PointLight uses cubemap (6 faces), cap at 1024 for performance
    configureLightShadow(
      light,
      properties.shadow_bias,
      properties.shadow_filter,
      DEFAULT_SHADOW_BIAS.OMNI,
      1024
    );
  }

  return light;
}

