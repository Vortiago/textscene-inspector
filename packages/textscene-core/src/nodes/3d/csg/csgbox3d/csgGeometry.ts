/** CSGBox3D's solid, exposed to the boolean evaluator. */

import { primitiveSolid, type CsgGeometryBuilder } from '../../../../r3f/csg/csgRegistration';
import { buildCsgBoxGeometry } from './boxGeometry';
import type { CSGBox3DProperties } from './types';

export const csgBox3DGeometry: CsgGeometryBuilder = (properties) => {
  const p = properties as unknown as CSGBox3DProperties;
  return primitiveSolid(buildCsgBoxGeometry({ size: p.size, flipFaces: p.flipFaces ?? false }), p);
};

export function csgBox3DGeometryKey(properties: Record<string, unknown>): string {
  const p = properties as unknown as CSGBox3DProperties;
  return `box:${p.size.x},${p.size.y},${p.size.z},${p.flipFaces ?? false}`;
}
