import { describe, expect, it } from 'vitest';
import { importanceSampleFilter } from './importanceSampleFilter';
import { blankOctmap, type Octmap } from './octmapImage';
import type { OctDirection } from '../../godot/octmap';

function chain(value: number): Octmap[] {
  return importanceSampleFilter.chainSizes.map((size) => {
    const mip = blankOctmap(size);
    mip.rgb.fill(value);
    return mip;
  });
}

function texel(normal: OctDirection, mips: Octmap[], layer: number): Float32Array {
  const out = new Float32Array(3).fill(9);
  importanceSampleFilter.texel(normal, mips, layer, out);
  return out;
}

describe('importanceSampleFilter', () => {
  it.each([1, 4, 7])('gives a uniform sky its own radiance at layer %i', (layer) => {
    expect(texel([0.48, 0.6, 0.64], chain(0.5), layer)[1]).toBeCloseTo(0.5, 5);
  });

  it('builds its frame on z where the direction is straight up (edge case)', () => {
    expect(texel([0, 1, 0], chain(0.25), 2)[0]).toBeCloseTo(0.25, 5);
  });

  it('overwrites what `out` held, rather than adding to it (error case)', () => {
    expect(texel([1, 0, 0], chain(0), 3)).toEqual(new Float32Array(3));
  });
});
