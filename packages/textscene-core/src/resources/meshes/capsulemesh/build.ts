/** CapsuleMesh geometry: Godot's `height` spans the caps, three's does not. */

import * as THREE from 'three';
import type { CapsuleMeshProperties } from './types.js';

export function buildCapsuleMeshGeometry(p: CapsuleMeshProperties): THREE.BufferGeometry {
  // Godot's `height` is the total height including both hemisphere caps. three
  // wants only the cylindrical mid-section.
  const mid = Math.max(0.01, p.height - 2 * p.radius);
  return new THREE.CapsuleGeometry(p.radius, mid, p.rings, p.radialSegments);
}
