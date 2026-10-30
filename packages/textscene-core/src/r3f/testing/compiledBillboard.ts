/** The surface billboard a material's program compiles (`surfaceBillboard.ts`), read from its vertex text. */

import type * as THREE from 'three';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode';
import { patchedVertex } from './patchedFragment';

export interface CompiledBillboard {
  mode: number;
  keepsScale: boolean;
}

/** A line only each mode's basis writes. */
const MODE_MARKERS: readonly [number, string][] = [
  [BillboardMode.BILLBOARD_ENABLED, 'godotMainCameraWorld[ 0 ],'],
  [BillboardMode.BILLBOARD_FIXED_Y, 'vec3 godotAxisX'],
  [BillboardMode.BILLBOARD_PARTICLES, 'normalize( godotPassCameraWorld[ 0 ] )'],
];

/** The billboard `material` compiles, or null for a program with none. */
export function compiledBillboard(material: THREE.Material): CompiledBillboard | null {
  const vertex = patchedVertex(material);
  if (!vertex.includes('mat4 godotBillboard()')) return null;
  const marked = MODE_MARKERS.find(([, marker]) => vertex.includes(marker));
  if (!marked) throw new Error(`expected a billboard basis in the vertex shader, got:\n${vertex}`);
  return { mode: marked[0], keepsScale: vertex.includes('length( godotModel[ 0 ].xyz )') };
}
