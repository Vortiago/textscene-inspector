import * as THREE from 'three';
import type { CapsuleMeshProperties } from './types';

export function createCapsuleMeshGeometry(properties: CapsuleMeshProperties): THREE.CapsuleGeometry {
  const { radius, height, rings, radialSegments } = properties;

  // Godot height includes hemisphere caps, three.js `height` parameter is
  // only the cylindrical section (renamed from `length` in three 0.184).
  const cylinderHeight = Math.max(0.01, height - 2 * radius);

  return new THREE.CapsuleGeometry(radius, cylinderHeight, rings, radialSegments);
}
