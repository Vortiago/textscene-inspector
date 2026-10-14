import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installSunShadowRows, SUN_SHADOW_ROWS, writeSunShadowRows } from './sunShadowRows';
import { SplitSunLight } from './splitSun';
import { SPLIT_SLOTS } from './splitShadow';
import { litUniformArray } from '../testing/litUniformArray';

/** Floats one sun shadow takes: four slots of three vec4 rows. */
const SUN_FLOATS = SPLIT_SLOTS * 3 * 4;

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

function writtenRows(lights: THREE.Light[]): Float32Array {
  writeSunShadowRows(lights);
  installSunShadowRows();
  return litUniformArray(SUN_SHADOW_ROWS);
}

describe('writeSunShadowRows', () => {
  it('writes the first three rows of each slot matrix, slot after slot', () => {
    const rows = writtenRows([sunWithSlotMatrices()]);
    expect([...rows.subarray(0, 12)]).toEqual([1, 0, 0, 0.5, 0, 2, 0, 0.25, 0, 0, 3, 0.125]);
    expect([...rows.subarray(36, 48)]).toEqual([4, 0, 0, 0.5, 0, 5, 0, 0.25, 0, 0, 6, 0.125]);
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

  it('writes nothing for a render without a sun shadow (error case)', () => {
    writtenRows([sunWithSlotMatrices(10)]);
    const rows = writtenRows([new THREE.PointLight()]);
    expect(rows[3]).toBe(10.5);
  });
});

describe('installSunShadowRows', () => {
  it('gives every lit built-in material the rows', () => {
    installSunShadowRows();
    expect(THREE.ShaderLib.physical.uniforms[SUN_SHADOW_ROWS]!.value).toBeInstanceOf(Float32Array);
  });
});
