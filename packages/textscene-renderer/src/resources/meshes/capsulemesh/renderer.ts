import * as THREE from 'three';
import type { CapsuleMeshProperties } from './types';

export function createCapsuleMeshGeometry(properties: CapsuleMeshProperties): THREE.CapsuleGeometry {
  const { radius, height, rings, radialSegments } = properties;

  // Godot height includes hemisphere caps, three.js length is only the cylinder
  const length = Math.max(0.01, height - 2 * radius);

  return new THREE.CapsuleGeometry(radius, length, rings, radialSegments);
}
