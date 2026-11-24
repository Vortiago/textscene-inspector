import { describe, expect, it } from 'vitest';
import { volumeMipChain, type VolumeLevel } from './volumeMipChain';

/** A volume of RGBA8 texels whose red bytes are `reds`, the other channels 0 and alpha 255. */
function volume(reds: readonly number[], width: number, height: number, depth: number): VolumeLevel {
  const data = new Uint8Array(reds.length * 4);
  reds.forEach((red, index) => {
    data[index * 4] = red;
    data[index * 4 + 3] = 255;
  });
  return { data, width, height, depth };
}

const redsOf = ({ data }: VolumeLevel): number[] => [...data].filter((_, index) => index % 4 === 0);

describe('volumeMipChain', () => {
  it('halves each side down to 1 × 1 × 1, as the layered importer does', () => {
    const levels = volumeMipChain(volume(new Array(64).fill(0), 4, 2, 8));

    expect(levels.map(({ width, height, depth }) => [width, height, depth])).toEqual([
      [2, 1, 4],
      [1, 1, 2],
      [1, 1, 1],
    ]);
  });

  it('truncates the average of a 2 × 2 × 2 block, as set_pixel stores a byte', () => {
    const [level] = volumeMipChain(volume([10, 11, 10, 11, 10, 11, 10, 11], 2, 2, 2));

    expect(redsOf(level!)).toEqual([10]);
  });

  it('keeps alpha at 255 through every level', () => {
    const [level] = volumeMipChain(volume([10, 11, 10, 11, 10, 11, 10, 11], 2, 2, 2));

    expect(level!.data[3]).toBe(255);
  });

  it('reads only the first two texels of an odd side, as the importer samples at 2x + 0.5 (edge case)', () => {
    const [level] = volumeMipChain(volume([40, 81, 250], 3, 1, 1));

    expect(redsOf(level!)).toEqual([60]);
  });

  it('gives a 1 × 1 × 1 volume no levels (edge case)', () => {
    expect(volumeMipChain(volume([7], 1, 1, 1))).toEqual([]);
  });

  it('refuses texels that do not fill the volume (error case)', () => {
    expect(() => volumeMipChain({ data: new Uint8Array(4), width: 2, height: 1, depth: 1 })).toThrow(
      'expected 8 bytes for a 2 × 1 × 1 RGBA8 volume, got 4'
    );
  });
});
