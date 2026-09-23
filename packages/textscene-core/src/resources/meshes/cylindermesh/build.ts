/** CylinderMesh geometry. */

import * as THREE from 'three';
import type { CylinderMeshProperties } from './types.js';

export function buildCylinderMeshGeometry(p: CylinderMeshProperties): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(
    p.top_radius,
    p.bottom_radius,
    p.height,
    p.radial_segments ?? 64,
    p.rings ?? 4,
    // three can only drop both caps, so Godot's single-cap removal is not
    // representable. The ends open only when both caps are off.
    p.capTop === false && p.capBottom === false
  );
}
