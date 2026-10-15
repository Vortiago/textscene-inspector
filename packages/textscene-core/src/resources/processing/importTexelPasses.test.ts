import { describe, expect, it } from 'vitest';
import { invertGreen, keepRedGreen, premultiplyAlpha } from './importTexelPasses';

describe('premultiplyAlpha', () => {
  it("rounds each colour channel times alpha as Godot's integer form does", () => {
    const data = new Uint8Array([200, 100, 50, 128, 255, 255, 255, 255]);
    premultiplyAlpha(data);
    expect([...data]).toEqual([100, 50, 25, 128, 255, 255, 255, 255]);
  });

  it('reports a change only when a byte moved', () => {
    expect(premultiplyAlpha(new Uint8Array([10, 20, 30, 255]))).toBe(false);
    expect(premultiplyAlpha(new Uint8Array([10, 20, 30, 0]))).toBe(true);
  });

  it('turns a transparent texel black (edge case)', () => {
    const data = new Uint8Array([255, 128, 1, 0]);
    premultiplyAlpha(data);
    expect([...data]).toEqual([0, 0, 0, 0]);
  });
});

describe('invertGreen', () => {
  it('flips green through float32, truncating as set_pixel does', () => {
    const data = new Uint8Array([10, 0, 30, 255, 10, 1, 30, 255, 10, 128, 30, 7]);
    invertGreen(data, false);
    expect([...data]).toEqual([10, 255, 30, 255, 10, 254, 30, 255, 10, 126, 30, 7]);
  });

  it('stores the brightest channel in every channel of a greyscale image', () => {
    const data = new Uint8Array([64, 64, 64, 255, 200, 200, 200, 255]);
    invertGreen(data, true);
    expect([...data]).toEqual([191, 191, 191, 255, 200, 200, 200, 255]);
  });

  it('keeps alpha (edge case)', () => {
    const data = new Uint8Array([0, 0, 0, 3]);
    invertGreen(data, false);
    expect(data[3]).toBe(3);
  });
});

describe('keepRedGreen', () => {
  it('zeroes blue and makes alpha opaque, as an RGTC texture samples', () => {
    const data = new Uint8Array([200, 100, 50, 128]);
    keepRedGreen(data);
    expect([...data]).toEqual([200, 100, 0, 255]);
  });

  it('reports no change when blue is 0 and alpha opaque', () => {
    expect(keepRedGreen(new Uint8Array([200, 100, 0, 255]))).toBe(false);
  });

  it('leaves an empty image unchanged (edge case)', () => {
    expect(keepRedGreen(new Uint8Array(0))).toBe(false);
  });
});
