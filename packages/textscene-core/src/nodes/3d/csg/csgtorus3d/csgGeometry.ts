/** CSGTorus3D's solid, exposed to the boolean evaluator. */

import { primitiveSolid, type CsgGeometryBuilder } from '../../../../r3f/csg/csgRegistration';
import { buildCsgTorusGeometry } from './torusGeometry';
import type { CSGTorus3DProperties } from './types';

export const csgTorus3DGeometry: CsgGeometryBuilder = (properties) => {
  const p = properties as unknown as CSGTorus3DProperties;
  return primitiveSolid(
    buildCsgTorusGeometry({
      innerRadius: p.innerRadius,
      outerRadius: p.outerRadius,
      sides: p.sides,
      ringSides: p.ringSides,
      smoothFaces: p.smoothFaces,
      flipFaces: p.flipFaces,
    }),
    p
  );
};

export function csgTorus3DGeometryKey(properties: Record<string, unknown>): string {
  const p = properties as unknown as CSGTorus3DProperties;
  return `tor:${p.innerRadius},${p.outerRadius},${p.sides},${p.ringSides},${p.smoothFaces},${p.flipFaces}`;
}
