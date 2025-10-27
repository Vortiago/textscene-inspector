/**
 * BoxMesh renderer - creates three.js geometry from BoxMesh data.
 */

import * as THREE from 'three';
import type { BoxMeshProperties } from './types';

/**
 * Create a THREE.BoxGeometry from BoxMesh properties.
 */
export function createBoxMeshGeometry(properties: BoxMeshProperties): THREE.BoxGeometry {
  const { size } = properties;

  return new THREE.BoxGeometry(size.x, size.y, size.z);
}
