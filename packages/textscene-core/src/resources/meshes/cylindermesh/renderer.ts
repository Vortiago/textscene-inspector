/**
 * CylinderMesh renderer - creates THREE.js cylinder geometry from CylinderMesh properties.
 */

import * as THREE from 'three';
import type { CylinderMeshProperties } from './types';

/**
 * Create a THREE.CylinderGeometry from CylinderMesh properties.
 * Maps Godot cylinder parameters to THREE.js equivalents.
 */
export function createCylinderMeshGeometry(properties: CylinderMeshProperties): THREE.CylinderGeometry {
  const { top_radius, bottom_radius, height } = properties;

  // Use provided segments or THREE.js defaults
  const radialSegments = properties.radial_segments ?? 32;
  const heightSegments = properties.rings ?? 1;

  return new THREE.CylinderGeometry(
    top_radius,
    bottom_radius,
    height,
    radialSegments,
    heightSegments
  );
}
