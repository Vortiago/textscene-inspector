/** CSGSphere3D's solid, exposed to the boolean evaluator. */

import type * as THREE from 'three';
import type { CsgGeometryBuilder } from '../../../../r3f/csg/csgRegistration';
import { buildCsgSphereGeometry } from './sphereGeometry';
import type { CSGSphere3DProperties } from './types';

export const csgSphere3DGeometry: CsgGeometryBuilder = (properties): THREE.BufferGeometry => {
  const p = properties as unknown as CSGSphere3DProperties;
  return buildCsgSphereGeometry({
    radius: p.radius,
    radialSegments: p.radialSegments,
    rings: p.rings,
    smoothFaces: p.smoothFaces,
    flipFaces: p.flipFaces,
  });
};

export function csgSphere3DGeometryKey(properties: Record<string, unknown>): string {
  const p = properties as unknown as CSGSphere3DProperties;
  return `sph:${p.radius},${p.radialSegments},${p.rings},${p.smoothFaces},${p.flipFaces}`;
}
