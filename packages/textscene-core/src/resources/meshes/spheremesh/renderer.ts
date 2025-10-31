/**
 * SphereMesh renderer - creates THREE.js sphere geometry from SphereMesh properties.
 */

import * as THREE from 'three';
import type { SphereMeshProperties } from './types';

/**
 * Create a THREE.SphereGeometry from SphereMesh properties.
 * Maps Godot sphere parameters to THREE.js equivalents.
 */
export function createSphereMeshGeometry(properties: SphereMeshProperties): THREE.SphereGeometry {
  const { radius } = properties;

  // Use provided segments or THREE.js defaults
  const widthSegments = properties.radial_segments ?? 32;
  const heightSegments = properties.rings ?? 16;

  return new THREE.SphereGeometry(
    radius,
    widthSegments,
    heightSegments
  );
}
