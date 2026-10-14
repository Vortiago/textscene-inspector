/**
 * The world-to-atlas matrix of every sun shadow slot, as the three rows the patched lookup reads
 * (`splitShadowChunk.ts`). The fourth row of a slot matrix is always (0, 0, 0, 1), so three rows
 * hold it in three vectors where three's `mat4` takes four.
 */

import type * as THREE from 'three';
import { SPLIT_SLOTS } from './splitShadow.js';
import { isSplitSun } from './splitSun.js';
import { LightUniformArrays } from '../shaderPatch/lightUniformArrays.js';

export const SUN_SHADOW_ROWS = 'godotSunShadowRows';

/** The rows of one slot matrix that the lookup reads. */
export const SLOT_MATRIX_ROWS = 3;

/** `Matrix4.elements` holds four columns of four floats. */
const MATRIX_SIZE = 4;
const SLOT_FLOATS = SLOT_MATRIX_ROWS * MATRIX_SIZE;

/** One slot's rows per slot of each sun shadow. Written only by `writeSunShadowRows`. */
const arrays = new LightUniformArrays({ [SUN_SHADOW_ROWS]: SPLIT_SLOTS * SLOT_FLOATS });

/** Gives the rows to every built-in lit material. */
export function installSunShadowRows(): void {
  arrays.install();
}

/**
 * Writes the rows of each split sun among `lights`, in their order. Pass the lights of three's
 * shadow pass, after it has updated the slot matrices: three lists every sun shadow in that order
 * (r186 `WebGLLights.js:289-325`). It runs on every pass, so it allocates no list of suns.
 */
export function writeSunShadowRows(lights: readonly THREE.Light[]): void {
  const sunCount = lights.reduce((count, light) => (isSplitSun(light) ? count + 1 : count), 0);
  if (sunCount === 0) return;
  arrays.write(sunCount, (set) => {
    let offset = 0;
    for (const light of lights) {
      if (!isSplitSun(light)) continue;
      for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
        writeSlotRows(light.shadow.getMatrix(slot), set[SUN_SHADOW_ROWS], offset);
        offset += SLOT_FLOATS;
      }
    }
  });
}

/** `Matrix4.elements` is column-major, so row `r` is elements `r`, `r + 4`, `r + 8` and `r + 12`. */
function writeSlotRows(matrix: THREE.Matrix4, rows: Float32Array, offset: number): void {
  const { elements } = matrix;
  for (let row = 0; row < SLOT_MATRIX_ROWS; row++) {
    for (let column = 0; column < MATRIX_SIZE; column++) {
      rows[offset + row * MATRIX_SIZE + column] = elements[column * MATRIX_SIZE + row]!;
    }
  }
}
