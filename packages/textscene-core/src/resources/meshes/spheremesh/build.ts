/** SphereMesh geometry: `is_hemisphere` halves the polar sweep. */

import * as THREE from 'three';
import type { SphereMeshProperties } from './types.js';

export function buildSphereMeshGeometry(p: SphereMeshProperties): THREE.BufferGeometry {
  // is_hemisphere sweeps theta 0..pi/2 instead of 0..pi.
  return new THREE.SphereGeometry(
    p.radius,
    p.radial_segments ?? 64,
    p.rings ?? 32,
    0,
    Math.PI * 2,
    0,
    p.isHemisphere ? Math.PI / 2 : Math.PI
  );
}
