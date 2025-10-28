import * as THREE from 'three';
import type { TorusMeshProperties } from './types';

export function createTorusMeshGeometry(properties: TorusMeshProperties): THREE.TorusGeometry {
  const { innerRadius, outerRadius, rings, ringSegments } = properties;

  // Godot uses inner/outer radii, three.js uses center radius and tube radius
  const radius = (outerRadius + innerRadius) / 2;
  const tube = (outerRadius - innerRadius) / 2;

  return new THREE.TorusGeometry(radius, tube, ringSegments, rings);
}
