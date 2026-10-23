import { describe, expect, it } from 'vitest';
import { regionUvWindow } from './regionUvWindow';

const SIZE = { x: 64, y: 32 };

describe('regionUvWindow', () => {
  it('is the identity window for the whole texture', () => {
    expect(regionUvWindow({ x: 0, y: 0, w: 64, h: 32 }, SIZE)).toEqual({
      repeat: { x: 1, y: 1 },
      offset: { x: 0, y: 0 },
    });
  });

  it("puts a region at the image's top on three's top v, since three's v runs bottom-up", () => {
    expect(regionUvWindow({ x: 16, y: 0, w: 16, h: 8 }, SIZE)).toEqual({
      repeat: { x: 0.25, y: 0.25 },
      offset: { x: 0.25, y: 0.75 },
    });
  });

  it('puts a region at the bottom of the image at v = 0 (edge case)', () => {
    expect(regionUvWindow({ x: 0, y: 24, w: 32, h: 8 }, SIZE).offset).toEqual({ x: 0, y: 0 });
  });

  it('reaches past [0, 1] for a region larger than the texture (edge case)', () => {
    expect(regionUvWindow({ x: -32, y: -16, w: 128, h: 64 }, SIZE)).toEqual({
      repeat: { x: 2, y: 2 },
      offset: { x: -0.5, y: -0.5 },
    });
  });
});
