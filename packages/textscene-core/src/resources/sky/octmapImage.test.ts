import { describe, expect, it } from 'vitest';
import { addBilinear, addTrilinear, blankOctmap, type Octmap } from './octmapImage';

/** A 2x2 octmap whose texels hold 0, 1, 2 and 3 in every channel. */
function ramp(): Octmap {
  const octmap = blankOctmap(2);
  [0, 1, 2, 3].forEach((value, texel) => octmap.rgb.fill(value, texel * 3, texel * 3 + 3));
  return octmap;
}

function flat(size: number, value: number): Octmap {
  const octmap = blankOctmap(size);
  octmap.rgb.fill(value);
  return octmap;
}

describe('addBilinear', () => {
  it('adds the texel at a texel centre, times the weight', () => {
    const out = new Float32Array(3).fill(1);
    addBilinear(ramp(), 0.75, 0.25, 2, out, 0);
    expect([...out]).toEqual([3, 3, 3]);
  });

  it('blends the four texels around a point between them', () => {
    const out = new Float32Array(6);
    addBilinear(ramp(), 0.5, 0.5, 1, out, 3);
    expect([...out]).toEqual([0, 0, 0, 1.5, 1.5, 1.5]);
  });

  it('clamps a point past the edge to the edge texel (edge case)', () => {
    const out = new Float32Array(3);
    addBilinear(ramp(), -0.5, 1.5, 1, out, 0);
    expect(out[0]).toBe(2);
  });
});

describe('addTrilinear', () => {
  const mips = [flat(4, 1), flat(2, 3)];

  it('blends the two mips around the lod', () => {
    const out = new Float32Array(3);
    addTrilinear(mips, 0.5, 0.5, 0.5, 1, out);
    expect(out[0]).toBeCloseTo(2, 6);
  });

  it('clamps a lod past the last mip to the last mip (edge case)', () => {
    const out = new Float32Array(3);
    addTrilinear(mips, 0.5, 0.5, 5.8, 2, out);
    expect(out[0]).toBe(6);
  });
});
