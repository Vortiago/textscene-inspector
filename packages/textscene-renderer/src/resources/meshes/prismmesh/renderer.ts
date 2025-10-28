import * as THREE from 'three';
import type { PrismMeshProperties } from './types';

export function createPrismMeshGeometry(properties: PrismMeshProperties): THREE.CylinderGeometry {
  const { size, subdivideHeight } = properties;

  // Approximate using CylinderGeometry with 3 radial segments for triangular cross-section
  const geometry = new THREE.CylinderGeometry(
    size.x / 2,
    size.x / 2,
    size.y,
    3,
    Math.max(1, subdivideHeight),
    false
  );

  geometry.rotateY(Math.PI / 6);

  return geometry;
}
