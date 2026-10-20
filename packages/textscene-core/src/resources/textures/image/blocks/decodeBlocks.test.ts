/** The block walk of a block-compressed image's top level, with a stand-in block format. */
import { describe, expect, it } from 'vitest';
import { BLOCK_FORMATS, decodeBlocks, type BlockFormat } from './decodeBlocks';

/** A one-byte block whose 16 texels are each `[byte, texel, 0, 255]`. */
const STAMP: BlockFormat = {
  bytesPerBlock: 1,
  decode: (bytes, offset, texels) => {
    for (let texel = 0; texel < 16; texel++) texels.set([bytes[offset]!, texel, 0, 255], texel * 4);
  },
};

function texelAt(out: Uint8Array, width: number, x: number, y: number): number[] {
  return [...out.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
}

describe('decodeBlocks', () => {
  it('lays the blocks out left to right, top row first', () => {
    const out = decodeBlocks(new Uint8Array([1, 2, 3, 4]), { width: 8, height: 8 }, STAMP)!;
    expect(texelAt(out, 8, 0, 0)).toEqual([1, 0, 0, 255]);
    expect(texelAt(out, 8, 4, 0)).toEqual([2, 0, 0, 255]);
    expect(texelAt(out, 8, 0, 4)).toEqual([3, 0, 0, 255]);
    expect(texelAt(out, 8, 7, 7)).toEqual([4, 15, 0, 255]);
  });

  it('decodes nothing from data shorter than the padded top level (error path)', () => {
    expect(decodeBlocks(new Uint8Array([1, 2, 3]), { width: 5, height: 5 }, STAMP)).toBeNull();
  });

  it('crops the padding of a size that is not a multiple of the block (edge case)', () => {
    const out = decodeBlocks(new Uint8Array([1, 2, 3, 4]), { width: 5, height: 5 }, STAMP)!;
    expect(out.length).toBe(5 * 5 * 4);
    expect(texelAt(out, 5, 3, 3)).toEqual([1, 15, 0, 255]);
    expect(texelAt(out, 5, 4, 4)).toEqual([4, 0, 0, 255]);
  });

  it('reads only the top level of data that also holds mipmaps (edge case)', () => {
    const out = decodeBlocks(new Uint8Array([7, 8]), { width: 4, height: 4 }, STAMP)!;
    expect(out.length).toBe(4 * 4 * 4);
    expect(texelAt(out, 4, 3, 3)).toEqual([7, 15, 0, 255]);
  });
});

describe('BLOCK_FORMATS', () => {
  it('holds each S3TC and RGTC format by its Godot name, with its block size', () => {
    expect(
      Object.fromEntries(
        Object.entries(BLOCK_FORMATS).map(([name, { bytesPerBlock }]) => [name, bytesPerBlock])
      )
    ).toEqual({
      'DXT1 RGB8': 8,
      'DXT3 RGBA8': 16,
      'DXT5 RGBA8': 16,
      FORMAT_DXT5_RA_AS_RG: 16,
      'RGTC Red8': 8,
      'RGTC RedGreen8': 16,
    });
  });
});
