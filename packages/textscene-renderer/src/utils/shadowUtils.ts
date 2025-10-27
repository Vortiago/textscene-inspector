/**
 * Shared shadow configuration utilities for lights
 */

import * as THREE from 'three';
import { SHADOW_BIAS_SCALE, SHADOW_RADIUS_DEFAULT } from './lightConstants';

/**
 * Map Godot shadow filter enum to shadow map size.
 *
 * Godot shadow filter values:
 * - SHADOW_FILTER_NONE = 0
 * - SHADOW_FILTER_PCF3 = 1
 * - SHADOW_FILTER_PCF5 = 2
 * - SHADOW_FILTER_PCF13 = 3
 *
 * @param filter - Godot shadow filter quality level (0-3)
 * @param maxSize - Optional maximum size cap (useful for PointLight cubemaps)
 * @returns Shadow map size in pixels (power of 2)
 */
export function getShadowMapSize(filter?: number, maxSize?: number): number {
  let size: number;

  switch (filter) {
    case 0:
      size = 256;
      break;
    case 1:
      size = 512;
      break;
    case 2:
      size = 1024;
      break;
    case 3:
      size = 2048;
      break;
    default:
      size = 512; // Default to PCF3 equivalent
  }

  return maxSize !== undefined ? Math.min(size, maxSize) : size;
}

/**
 * Configure shadow properties for a three.js light.
 *
 * @param light - The three.js light to configure
 * @param shadowBias - Optional Godot shadow bias value (converted to three.js)
 * @param shadowFilter - Optional Godot shadow filter quality level
 * @param defaultBias - Default bias value if not provided in properties
 * @param maxMapSize - Optional maximum shadow map size (for PointLight optimization)
 */
export function configureLightShadow(
  light: THREE.SpotLight | THREE.DirectionalLight | THREE.PointLight,
  shadowBias: number | undefined,
  shadowFilter: number | undefined,
  defaultBias: number,
  maxMapSize?: number
): void {
  light.castShadow = true;

  // Shadow map size based on filter quality
  const mapSize = getShadowMapSize(shadowFilter, maxMapSize);
  light.shadow.mapSize.width = mapSize;
  light.shadow.mapSize.height = mapSize;

  // Shadow bias (convert from Godot's positive to three.js negative)
  if (shadowBias !== undefined) {
    light.shadow.bias = -shadowBias * SHADOW_BIAS_SCALE;
  } else {
    light.shadow.bias = defaultBias;
  }

  // Soft shadows
  light.shadow.radius = SHADOW_RADIUS_DEFAULT;
}
