import { describe, expect, it } from 'vitest';
import { fractionOfAtlas } from './atlasFraction';

describe('fractionOfAtlas', () => {
  it('divides the left and width by the atlas width, the top and height by its height', () => {
    const rect = { x: 32, y: 16, width: 64, height: 8 };
    expect(fractionOfAtlas(rect, { width: 128, height: 64 })).toEqual({
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.125,
    });
  });
});
