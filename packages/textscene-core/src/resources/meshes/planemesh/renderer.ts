import * as THREE from 'three';
import type { PlaneMeshProperties } from './types';

export function createPlaneMeshGeometry(properties: PlaneMeshProperties): THREE.PlaneGeometry {
  const { size, subdivideWidth, subdivideDepth, orientation, centerOffset } = properties;

  const geometry = new THREE.PlaneGeometry(
    size.x,
    size.y,
    Math.max(1, subdivideWidth),
    Math.max(1, subdivideDepth)
  );

  // Godot orientation: 0=FACE_X, 1=FACE_Y, 2=FACE_Z
  switch (orientation) {
    case 0:
      geometry.rotateY(Math.PI / 2);
      break;
    case 1:
      geometry.rotateX(-Math.PI / 2);
      break;
  }

  // Apply center_offset by translating geometry vertices
  if (centerOffset.x !== 0 || centerOffset.y !== 0 || centerOffset.z !== 0) {
    geometry.translate(centerOffset.x, centerOffset.y, centerOffset.z);
  }

  return geometry;
}
