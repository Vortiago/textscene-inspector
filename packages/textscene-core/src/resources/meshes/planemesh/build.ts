/**
 * PlaneMesh geometry, shared with its QuadMesh subclass (same property shape,
 * different defaults, which the decode supplies).
 */

import * as THREE from 'three';
import type { PlaneMeshProperties } from './types.js';

export function buildPlaneMeshGeometry(p: PlaneMeshProperties): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(
    p.size.x,
    p.size.y,
    p.subdivideWidth + 1,
    p.subdivideDepth + 1
  );
  // three's PlaneGeometry is an XY plane with normal +Z, which is Godot's FACE_Z (2).
  // FACE_X (0) rotates it into YZ, FACE_Y (1) into XZ.
  if (p.orientation === 0) geom.rotateY(Math.PI / 2);
  else if (p.orientation === 1) geom.rotateX(-Math.PI / 2);

  const offset = p.centerOffset;
  if (offset) geom.translate(offset.x, offset.y, offset.z);

  // flip_faces reverses winding so the surface is visible from the other side.
  if (p.flipFaces) {
    geom.scale(-1, 1, 1);
    geom.computeVertexNormals();
  }
  return geom;
}
