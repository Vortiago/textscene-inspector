/** CSGSphere3D's solid, exposed to the boolean evaluator. */

import { primitiveSolid, type CsgGeometryBuilder } from '../../../../r3f/csg/csgRegistration';
import { buildCsgSphereGeometry } from './sphereGeometry';
import type { CSGSphere3DProperties } from './types';

export const csgSphere3DGeometry: CsgGeometryBuilder = (properties) => {
  const p = properties as unknown as CSGSphere3DProperties;
  return primitiveSolid(
    buildCsgSphereGeometry({
      radius: p.radius,
      radialSegments: p.radialSegments,
      rings: p.rings,
      smoothFaces: p.smoothFaces,
      flipFaces: p.flipFaces,
    }),
    p
  );
};

export function csgSphere3DGeometryKey(properties: Record<string, unknown>): string {
  const p = properties as unknown as CSGSphere3DProperties;
  return `sph:${p.radius},${p.radialSegments},${p.rings},${p.smoothFaces},${p.flipFaces}`;
}
