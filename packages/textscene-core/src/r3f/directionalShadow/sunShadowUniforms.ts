/**
 * The terms of every sun shadow that the patched lookup reads beyond three's own (`splitShadowChunk.ts`),
 * in three's order of its sun shadows. Per sun: three rows of each slot's world-to-atlas matrix, the
 * direction towards the light with the soft shadow angle, and each slot's range start. The fourth row
 * of a slot matrix is always (0, 0, 0, 1), so three rows hold it in three vectors where `mat4` takes four.
 */

import * as THREE from 'three';
import { SPLIT_SLOTS } from './splitShadow.js';
import { isSplitSun, type SplitSunLight } from './splitSun.js';
import { LightUniformArrays } from '../shaderPatch/lightUniformArrays.js';
import { writeVec4 } from '../writeVec4.js';

export const SUN_SHADOW_ROWS = 'godotSunShadowRows';
export const SUN_SOFT_SHADOWS = 'godotSunSoftShadows';
export const SUN_RANGE_BEGINS = 'godotSunRangeBegins';

/** The rows of one slot matrix that the lookup reads. */
export const SLOT_MATRIX_ROWS = 3;

/** `Matrix4.elements` holds four columns of four floats. */
const MATRIX_SIZE = 4;
const SLOT_FLOATS = SLOT_MATRIX_ROWS * MATRIX_SIZE;
const SUN_ROW_FLOATS = SPLIT_SLOTS * SLOT_FLOATS;

/** One vec4: the direction towards the light, and the angle. */
const SOFT_SHADOW_FLOATS = 4;

/** Each array's floats per sun shadow. Written only by `writeSunShadowUniforms`. */
const arrays = new LightUniformArrays({
  [SUN_SHADOW_ROWS]: SUN_ROW_FLOATS,
  [SUN_SOFT_SHADOWS]: SOFT_SHADOW_FLOATS,
  [SUN_RANGE_BEGINS]: SPLIT_SLOTS,
});

/** Scratch for the writer, which runs on every shadow pass. */
const scratchDirection = new THREE.Vector3();

/** Gives the arrays to every built-in lit material. */
export function installSunShadowUniforms(): void {
  arrays.install();
}

/**
 * Writes the terms of each split sun among `lights`, in their order. Pass the lights of three's
 * shadow pass, after it has updated the slot matrices: three lists every sun shadow in that order
 * (r186 `WebGLLights.js:289-325`). It runs on every pass, so it allocates no list of suns.
 */
export function writeSunShadowUniforms(lights: readonly THREE.Light[]): void {
  const sunCount = lights.reduce((count, light) => (isSplitSun(light) ? count + 1 : count), 0);
  if (sunCount === 0) return;
  arrays.write(sunCount, (set) => {
    let index = 0;
    for (const light of lights) {
      if (!isSplitSun(light)) continue;
      writeSunRows(light, set[SUN_SHADOW_ROWS], index * SUN_ROW_FLOATS);
      writeSoftShadow(light, set[SUN_SOFT_SHADOWS], index);
      light.shadow.rangeBegins.toArray(set[SUN_RANGE_BEGINS], index * SPLIT_SLOTS);
      index++;
    }
  });
}

function writeSunRows(sun: SplitSunLight, rows: Float32Array, offset: number): void {
  for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
    writeSlotRows(sun.shadow.getMatrix(slot), rows, offset + slot * SLOT_FLOATS);
  }
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

/** The fitter places the sun at the light's offset from its target (`followDeclaredLight`). */
function writeSoftShadow(sun: SplitSunLight, softShadows: Float32Array, index: number): void {
  const { x, y, z } = scratchDirection.setFromMatrixPosition(sun.matrixWorld).normalize();
  writeVec4(softShadows, index, x, y, z, sun.shadow.softShadowAngle);
}
