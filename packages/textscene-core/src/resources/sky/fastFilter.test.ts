import { describe, expect, it } from 'vitest';
import { fastFilter } from './fastFilter';
import { blankOctmap, type Octmap } from './octmapImage';
import type { OctDirection } from '../../godot/octmap';

/** The filter's chain, each mip filled by `radiance` from the texel's row, 0 at the top. */
function chain(radiance: (row: number, size: number) => number): Octmap[] {
  return fastFilter.chainSizes.map((size) => {
    const mip = blankOctmap(size);
    for (let texel = 0; texel < size * size; texel += 1) {
      mip.rgb.fill(radiance(Math.floor(texel / size), size), texel * 3, texel * 3 + 3);
    }
    return mip;
  });
}

function texel(normal: OctDirection, mips: Octmap[], layer: number): Float32Array {
  const out = new Float32Array(3);
  fastFilter.texel(normal, mips, layer, out);
  return out;
}

const UP: OctDirection = [0, 1, 0];
const OBLIQUE: OctDirection = [0.48, 0.6, 0.64];

describe('fastFilter', () => {
  it.each([1, 3, 6])('gives a uniform sky its own radiance at layer %i', (layer) => {
    expect(
      [
        ...texel(
          OBLIQUE,
          chain(() => 0.5),
          layer
        ),
      ].map((v) => v.toFixed(4))
    ).toEqual(['0.5000', '0.5000', '0.5000']);
  });

  it('reads layer 6 for a layer past the last a real-time sky has (edge case)', () => {
    const mips = chain((row, size) => row / size);
    expect(texel(OBLIQUE, mips, 7)).toEqual(texel(OBLIQUE, mips, 6));
  });

  it('never writes a negative colour, though its taps weigh some below zero (error case)', () => {
    const mips = chain((row, size) => (row < size / 2 ? 0 : 4));
    for (const layer of [1, 2, 3, 4, 5, 6]) {
      expect(Math.min(...texel(UP, mips, layer))).toBeGreaterThanOrEqual(0);
    }
  });
});
