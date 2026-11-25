import * as THREE from 'three';
import { texture } from 'three/tsl';
import type { TextureNode } from 'three/webgpu';
import { dfgHalfFloats } from '../../godot/rendering/materials/dfg.js';
import { DFG_SIZE } from '../../godot/rendering/materials/dfgTable.generated.js';

/** Written only by `dfgTexture`, once: every program reads the one table, as Godot binds one. */
let table: THREE.DataTexture | undefined;

/** Godot's DFG table (`render_forward_clustered.cpp:5087-5126`), read with a linear sampler. */
export function dfgTexture(): THREE.DataTexture {
  if (table) return table;
  table = new THREE.DataTexture(
    godotRows(dfgHalfFloats()),
    DFG_SIZE,
    DFG_SIZE,
    THREE.RGFormat,
    THREE.HalfFloatType
  );
  table.magFilter = THREE.LinearFilter;
  table.minFilter = THREE.LinearFilter;
  table.needsUpdate = true;
  return table;
}

/** Rows from roughness 1 down, as Godot stores them and `prefiltered_dfg` reads them at `1 - lod`. */
function godotRows(byRoughness: Uint16Array): Uint16Array {
  const rowLength = DFG_SIZE * 2;
  const rows = new Uint16Array(byRoughness.length);
  for (let row = 0; row < DFG_SIZE; row++)
    rows.set(byRoughness.subarray(row * rowLength, (row + 1) * rowLength), (DFG_SIZE - 1 - row) * rowLength);
  return rows;
}

/** The node of the template's `dfg` texture. */
export function dfgTextureNode(): TextureNode {
  return texture(dfgTexture()) as unknown as TextureNode;
}
