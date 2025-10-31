import * as THREE from 'three';
import type { PlaneMeshProperties } from './types';

export function createPlaneMeshGeometry(properties: PlaneMeshProperties): THREE.PlaneGeometry {
  const { size, subdivideWidth, subdivideDepth, orientation } = properties;

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

  return geometry;
}
