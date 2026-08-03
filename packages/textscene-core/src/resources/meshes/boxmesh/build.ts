/** BoxMesh geometry: Godot's `subdivide_*` counts extra edge loops, three counts segments. */

import * as THREE from 'three';
import type { BoxMeshProperties } from './types.js';

export function buildBoxMeshGeometry(p: BoxMeshProperties): THREE.BufferGeometry {
  // N extra edge loops give N+1 face segments.
  return new THREE.BoxGeometry(
    p.size.x,
    p.size.y,
    p.size.z,
    p.subdivideWidth + 1,
    p.subdivideHeight + 1,
    p.subdivideDepth + 1
  );
}
