/**
 * The world-to-atlas matrix of every sun shadow slot, as the three rows the patched lookup reads
 * (`splitShadowChunk.ts`). The fourth row of a slot matrix is always (0, 0, 0, 1), so three rows
 * hold it in three vectors where three's `mat4` takes four.
 */

import type * as THREE from 'three';
import { DirectionalSplitShadow, SPLIT_SLOTS } from './splitShadow.js';
import { LightUniformArrays } from '../shaderPatch/lightUniformArrays.js';

export const SUN_SHADOW_ROWS = 'godotSunShadowRows';

/** The rows of one slot matrix that the lookup reads. */
export const SLOT_MATRIX_ROWS = 3;

const ROW_FLOATS = 4;
const SLOT_FLOATS = SLOT_MATRIX_ROWS * ROW_FLOATS;

/** One slot's rows per slot of each sun shadow. Written only by `writeSunShadowRows`. */
const arrays = new LightUniformArrays({ [SUN_SHADOW_ROWS]: SPLIT_SLOTS * SLOT_FLOATS });

/** Gives the rows to every built-in lit material. */
export function installSunShadowRows(): void {
  arrays.install();
}

/**
 * Writes the rows of each sun shadow among `lights`, in their order. Pass the lights of three's
 * shadow pass, after it has updated the slot matrices: three lists every sun shadow in that order
 * (r186 `WebGLLights.js:289-325`).
 */
export function writeSunShadowRows(lights: readonly THREE.Light[]): void {
  const shadows = sunShadowsOf(lights);
  if (shadows.length === 0) return;
  arrays.write(shadows.length, (set) => {
    const rows = set[SUN_SHADOW_ROWS];
    shadows.forEach((shadow, index) => {
      for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
        writeSlotRows(shadow.getMatrix(slot), rows, (index * SPLIT_SLOTS + slot) * SLOT_FLOATS);
      }
    });
  });
}

function sunShadowsOf(lights: readonly THREE.Light[]): DirectionalSplitShadow[] {
  const shadows: DirectionalSplitShadow[] = [];
  for (const light of lights) {
    const { isSunLight, shadow } = light as THREE.Light & { isSunLight?: boolean; shadow?: unknown };
    if (isSunLight && shadow instanceof DirectionalSplitShadow) shadows.push(shadow);
  }
  return shadows;
}

/** `Matrix4.elements` is column-major, so row `r` is elements `r`, `r + 4`, `r + 8` and `r + 12`. */
function writeSlotRows(matrix: THREE.Matrix4, rows: Float32Array, offset: number): void {
  const { elements } = matrix;
  for (let row = 0; row < SLOT_MATRIX_ROWS; row++) {
    for (let column = 0; column < ROW_FLOATS; column++) {
      rows[offset + row * ROW_FLOATS + column] = elements[column * 4 + row]!;
    }
  }
}
