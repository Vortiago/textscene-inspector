/**
 * PlaneMesh geometry, shared with its QuadMesh subclass (same property shape,
 * different defaults, which the decode supplies).
 */

import * as THREE from 'three';
import type { PlaneMeshProperties } from './types.js';
import { PlaneMeshOrientation } from '../../../godot/scene/planeMesh.js';

export function buildPlaneMeshGeometry(p: PlaneMeshProperties): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(p.size.x, p.size.y, p.subdivideWidth + 1, p.subdivideDepth + 1);
  // three's PlaneGeometry is an XY plane with normal +Z, which is Godot's FACE_Z.
  // FACE_X rotates it into YZ, FACE_Y into XZ.
  if (p.orientation === PlaneMeshOrientation.FACE_X) geom.rotateY(Math.PI / 2);
  else if (p.orientation === PlaneMeshOrientation.FACE_Y) geom.rotateX(-Math.PI / 2);

  const offset = p.centerOffset;
  if (offset) geom.translate(offset.x, offset.y, offset.z);
  return geom;
}
