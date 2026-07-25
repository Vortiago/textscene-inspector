/** CSGCylinder3D's solid, exposed to the boolean evaluator. */

import type * as THREE from 'three';
import type { CsgGeometryBuilder } from '../../../../r3f/csg/csgRegistration';
import { buildCsgCylinderGeometry } from './cylinderGeometry';
import type { CSGCylinder3DProperties } from './types';

export const csgCylinder3DGeometry: CsgGeometryBuilder = (properties): THREE.BufferGeometry => {
  const p = properties as unknown as CSGCylinder3DProperties;
  return buildCsgCylinderGeometry({
    radius: p.radius,
    height: p.height,
    sides: p.sides,
    cone: p.cone,
    smoothFaces: p.smoothFaces,
    flipFaces: p.flipFaces,
  });
};

export function csgCylinder3DGeometryKey(properties: Record<string, unknown>): string {
  const p = properties as unknown as CSGCylinder3DProperties;
  return `cyl:${p.radius},${p.height},${p.sides},${p.cone},${p.smoothFaces},${p.flipFaces}`;
}
