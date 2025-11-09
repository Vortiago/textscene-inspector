import * as THREE from 'three';
import type { PlaneMeshProperties } from './types';

export function createPlaneMeshGeometry(properties: PlaneMeshProperties): THREE.PlaneGeometry {
  const { size, subdivideWidth, subdivideDepth, orientation } = properties;

  // For FACE_X, size components map differently after rotation
  // FACE_X (YZ plane): size.x=Y, size.y=Z
  // FACE_Y (XZ plane): size.x=X, size.y=Z
  // FACE_Z (XY plane): size.x=X, size.y=Y
  let width = size.x;
  let height = size.y;
  let widthSegments = subdivideWidth;
  let heightSegments = subdivideDepth;

  if (orientation === 0) {
    // For FACE_X: swap dimensions because rotateY swaps X↔Z
    width = size.y;
    height = size.x;
    widthSegments = subdivideDepth;
    heightSegments = subdivideWidth;
  }

  const geometry = new THREE.PlaneGeometry(
    width,
    height,
    Math.max(1, widthSegments),
    Math.max(1, heightSegments)
  );

  // Godot orientation: 0=FACE_X, 1=FACE_Y, 2=FACE_Z
  // Rotate to match Godot's coordinate system
  switch (orientation) {
    case 0:
      // FACE_X: rotate to YZ plane with normal pointing in +X
      geometry.rotateY(Math.PI / 2);
      break;
    case 1:
      // FACE_Y: rotate to XZ plane with normal pointing in +Y
      geometry.rotateX(-Math.PI / 2);
      break;
  }

  return geometry;
}
