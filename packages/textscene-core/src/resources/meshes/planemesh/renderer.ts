import * as THREE from 'three';
import type { PlaneMeshProperties } from './types';

export function createPlaneMeshGeometry(properties: PlaneMeshProperties): THREE.PlaneGeometry {
  const { size, subdivideWidth, subdivideDepth, orientation, centerOffset, flipFaces } = properties;

  // Size mapping verified against Godot source (scene/resources/3d/primitive_meshes.cpp):
  // FACE_X: Vector3(0.0, z, x) → Y=size.y, Z=size.x
  // FACE_Y: Vector3(-x, 0.0, -z) → X=size.x, Z=size.y
  // FACE_Z: Vector3(-x, z, 0.0) → X=size.x, Y=size.y
  //
  // THREE.PlaneGeometry(width, height) creates XY plane
  // After rotateY(90°): width→Z, height→Y
  // After rotateX(-90°): width→X, height→Z
  // Both transformations preserve size.x→width and size.y→height mapping

  const geometry = new THREE.PlaneGeometry(
    size.x,
    size.y,
    Math.max(1, subdivideWidth),
    Math.max(1, subdivideDepth)
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

  // Apply flip_faces if enabled (reverses triangle winding order)
  // Godot docs: "reverses the order of the vertices in each triangle resulting in the backside of the mesh being drawn"
  if (flipFaces) {
    geometry.scale(-1, 1, 1);
    // Recompute normals after scaling to ensure they point in the correct direction
    geometry.computeVertexNormals();
  }

  // Apply center offset if provided
  if (centerOffset) {
    geometry.translate(centerOffset.x, centerOffset.y, centerOffset.z);
  }

  return geometry;
}
