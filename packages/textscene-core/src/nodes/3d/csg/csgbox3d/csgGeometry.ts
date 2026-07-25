/** CSGBox3D's solid, exposed to the boolean evaluator. */

import type * as THREE from 'three';
import type { CsgGeometryBuilder } from '../../../../r3f/csg/csgRegistration';
import { buildCsgBoxGeometry } from './boxGeometry';
import type { CSGBox3DProperties } from './types';

export const csgBox3DGeometry: CsgGeometryBuilder = (properties): THREE.BufferGeometry => {
  const p = properties as unknown as CSGBox3DProperties;
  return buildCsgBoxGeometry({ size: p.size, flipFaces: p.flipFaces ?? false });
};

export function csgBox3DGeometryKey(properties: Record<string, unknown>): string {
  const p = properties as unknown as CSGBox3DProperties;
  return `box:${p.size.x},${p.size.y},${p.size.z},${p.flipFaces ?? false}`;
}
