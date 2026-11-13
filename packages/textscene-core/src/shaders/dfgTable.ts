/** Godot's DFG table (`godot/rendering/materials/dfg.ts`) as the texture the lighting model reads. */

import * as THREE from 'three';
import { dfgHalfFloats } from '../godot/rendering/materials/dfg.js';
import { DFG_SIZE } from '../godot/rendering/materials/dfgTable.generated.js';

/** Written only by the first call of `dfgTable`, and kept for the page's life, as the table never changes. */
let table: THREE.DataTexture | null = null;

/** The table, read at `(NdotV, roughness)` with Godot's linear clamped sampler. */
export function dfgTable(): THREE.DataTexture {
  if (table) return table;
  table = new THREE.DataTexture(dfgHalfFloats(), DFG_SIZE, DFG_SIZE, THREE.RGFormat, THREE.HalfFloatType);
  table.magFilter = THREE.LinearFilter;
  table.minFilter = THREE.LinearFilter;
  table.needsUpdate = true;
  return table;
}
