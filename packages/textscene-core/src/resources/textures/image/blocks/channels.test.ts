/** The interpolated channel of BC3 alpha, BC4 and BC5, and the `rg01` swizzle. */
import { describe, expect, it } from 'vitest';
import { decodeInterpolatedChannel, swizzleRg01 } from './channels';

/** An interpolated block whose texel `n` reads index `n % 8`. */
function block(first: number, second: number): Uint8Array {
  let indices = 0n;
  for (let texel = 0n; texel < 16n; texel++) indices |= (texel % 8n) << (3n * texel);
  const bytes = new Uint8Array(8);
  bytes[0] = first;
  bytes[1] = second;
  for (let i = 0; i < 6; i++) bytes[2 + i] = Number((indices >> BigInt(8 * i)) & 0xffn);
  return bytes;
}

function channelOf(texels: Uint8Array, channel: number): number[] {
  return [...texels].filter((_, at) => at % 4 === channel);
}

describe('decodeInterpolatedChannel', () => {
  it('reads six values between endpoints whose first is above the second', () => {
    const texels = new Uint8Array(64);
    decodeInterpolatedChannel(block(200, 40), 0, texels, 3);
    expect(channelOf(texels, 3).slice(0, 8)).toEqual([200, 40, 177, 154, 131, 108, 85, 63]);
  });

  it('reads four values between endpoints whose first is below the second, then 0 and 255', () => {
    const texels = new Uint8Array(64);
    decodeInterpolatedChannel(block(40, 200), 0, texels, 0);
    expect(channelOf(texels, 0).slice(8)).toEqual([40, 200, 72, 104, 136, 168, 0, 255]);
  });

  it('reads equal endpoints as the four-value mode (edge case)', () => {
    const texels = new Uint8Array(64);
    decodeInterpolatedChannel(block(100, 100), 0, texels, 1);
    expect(channelOf(texels, 1).slice(0, 8)).toEqual([100, 100, 100, 100, 100, 100, 0, 255]);
  });

  it('reads the block at its offset and writes only its channel', () => {
    const texels = new Uint8Array(64).fill(9);
    decodeInterpolatedChannel(new Uint8Array([1, 2, 3, ...block(200, 40)]), 3, texels, 2);
    expect(channelOf(texels, 2)[0]).toBe(200);
    expect(channelOf(texels, 0)).toEqual(new Array(16).fill(9));
  });
});

describe('swizzleRg01', () => {
  it('reads blue as 0 and alpha as 255, keeping red and green', () => {
    const texels = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
    swizzleRg01(texels);
    expect([...texels]).toEqual([10, 20, 0, 255, 50, 60, 0, 255]);
  });

  it('leaves an empty texel array empty (edge case)', () => {
    const texels = new Uint8Array(0);
    swizzleRg01(texels);
    expect(texels.length).toBe(0);
  });
});
