/** CSGTorus3D's solid, exposed to the boolean evaluator. */

import type * as THREE from 'three';
import type { CsgGeometryBuilder } from '../../../../r3f/csg/csgRegistration';
import { buildCsgTorusGeometry } from './torusGeometry';
import type { CSGTorus3DProperties } from './types';

export const csgTorus3DGeometry: CsgGeometryBuilder = (properties): THREE.BufferGeometry => {
  const p = properties as unknown as CSGTorus3DProperties;
  return buildCsgTorusGeometry({
    innerRadius: p.innerRadius,
    outerRadius: p.outerRadius,
    sides: p.sides,
    ringSides: p.ringSides,
    smoothFaces: p.smoothFaces,
    flipFaces: p.flipFaces,
  });
};

export function csgTorus3DGeometryKey(properties: Record<string, unknown>): string {
  const p = properties as unknown as CSGTorus3DProperties;
  return `tor:${p.innerRadius},${p.outerRadius},${p.sides},${p.ringSides},${p.smoothFaces},${p.flipFaces}`;
}
