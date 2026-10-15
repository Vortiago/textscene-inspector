import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  installSunShadowUniforms,
  SLOT_MATRIX_ROWS,
  SUN_RANGE_BEGINS,
  SUN_SHADOW_FADES,
  SUN_SHADOW_ROWS,
  SUN_SOFT_SHADOWS,
  writeSunShadowUniforms,
} from './sunShadowUniforms';
import { SplitSunLight } from './splitSun';
import { NO_SHADOW_FADE, SPLIT_SLOTS } from './splitShadow';
import { litUniformArray } from '../testing/litUniformArray';

/** Floats one slot takes: three vec4 rows. */
const SLOT_FLOATS = SLOT_MATRIX_ROWS * 4;
const SUN_FLOATS = SPLIT_SLOTS * SLOT_FLOATS;

/** A split sun whose slot `n` maps x by `n + 1`, y by `n + 2`, z by `n + 3`, and offsets by `base`. */
function sunWithSlotMatrices(base = 0): SplitSunLight {
  const sun = new SplitSunLight();
  for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
    sun.shadow
      .getMatrix(slot)
      .set(slot + 1, 0, 0, base + 0.5, 0, slot + 2, 0, base + 0.25, 0, 0, slot + 3, base + 0.125, 0, 0, 0, 1);
  }
  return sun;
}

/** A split sun that fades from `from` to `to`. */
function fadingSun(from: number, to: number): SplitSunLight {
  const sun = new SplitSunLight();
  sun.shadow.fade = { from, to };
  return sun;
}

/** A split sun at `height` above the origin, with an angle and the range starts `base` to `base + 3`. */
function softSun(height: number, base: number): SplitSunLight {
  const sun = new SplitSunLight();
  sun.matrixWorld.makeTranslation(0, height, 0);
  sun.shadow.softShadowAngle = 0.5;
  sun.shadow.rangeBegins.set(base, base + 1, base + 2, base + 3);
  return sun;
}

function written(lights: THREE.Light[], name: string): Float32Array {
  writeSunShadowUniforms(lights);
  installSunShadowUniforms();
  return litUniformArray(name);
}

const writtenRows = (lights: THREE.Light[]) => written(lights, SUN_SHADOW_ROWS);

describe('writeSunShadowUniforms', () => {
  it('writes the first three rows of each slot matrix, slot after slot', () => {
    const rows = writtenRows([sunWithSlotMatrices()]);
    expect([...rows.subarray(0, SLOT_FLOATS)]).toEqual([1, 0, 0, 0.5, 0, 2, 0, 0.25, 0, 0, 3, 0.125]);
    expect([...rows.subarray(3 * SLOT_FLOATS, 4 * SLOT_FLOATS)]).toEqual([
      4, 0, 0, 0.5, 0, 5, 0, 0.25, 0, 0, 6, 0.125,
    ]);
  });

  it('writes each sun shadow in the order three lists the lights', () => {
    const rows = writtenRows([sunWithSlotMatrices(), sunWithSlotMatrices(10)]);
    expect([...rows.subarray(SUN_FLOATS, SUN_FLOATS + 4)]).toEqual([1, 0, 0, 10.5]);
  });

  it('skips a light that casts no sun shadow (edge case)', () => {
    const rows = writtenRows([new THREE.SpotLight(), sunWithSlotMatrices(10)]);
    expect([...rows.subarray(0, 4)]).toEqual([1, 0, 0, 10.5]);
  });

  it('holds the shadows of more suns than its first arrays had room for (edge case)', () => {
    const suns = Array.from({ length: 9 }, (_, index) => sunWithSlotMatrices(index * 10));
    const rows = writtenRows(suns);
    expect(rows[8 * SUN_FLOATS + 3]).toBe(80.5);
  });

  it('writes the direction towards each sun and its angle, in the same order as the rows', () => {
    const softShadows = written([softSun(10, 0), softSun(-4, 40)], SUN_SOFT_SHADOWS);
    expect([...softShadows.subarray(0, 8)]).toEqual([0, 1, 0, 0.5, 0, -1, 0, 0.5]);
  });

  it("writes each slot's range start, in the same order as the rows", () => {
    const rangeBegins = written([new THREE.SpotLight(), softSun(10, 0), softSun(10, 40)], SUN_RANGE_BEGINS);
    expect([...rangeBegins.subarray(0, 8)]).toEqual([0, 1, 2, 3, 40, 41, 42, 43]);
  });

  it("writes each sun's fade, in the same order as the rows", () => {
    const fades = written([new THREE.SpotLight(), fadingSun(64, 80), fadingSun(40, 50)], SUN_SHADOW_FADES);
    expect([...fades.subarray(0, 4)]).toEqual([64, 80, 40, 50]);
  });

  it('writes no fade for a sun no fit has placed (edge case)', () => {
    written([fadingSun(64, 80)], SUN_SHADOW_FADES);
    const unplaced = new SplitSunLight();
    expect(unplaced.shadow.fade).toBe(NO_SHADOW_FADE);
    const fades = written([unplaced], SUN_SHADOW_FADES);
    expect([...fades.subarray(0, 2)]).toEqual([0, 0]);
  });

  it('writes nothing for a render without a sun shadow (error case)', () => {
    writtenRows([sunWithSlotMatrices(10)]);
    const rows = writtenRows([new THREE.PointLight()]);
    expect(rows[3]).toBe(10.5);
  });
});

describe('installSunShadowUniforms', () => {
  it.each([SUN_SHADOW_ROWS, SUN_SOFT_SHADOWS, SUN_RANGE_BEGINS, SUN_SHADOW_FADES])(
    'gives every lit built-in material %s',
    (name) => {
      installSunShadowUniforms();
      expect(THREE.ShaderLib.physical.uniforms[name]!.value).toBeInstanceOf(Float32Array);
    }
  );
});
