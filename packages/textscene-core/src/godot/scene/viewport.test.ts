import { describe, expect, it } from 'vitest';
import { viewportPositionalShadowAtlas } from './viewport';

describe('viewportPositionalShadowAtlas', () => {
  it('reads the authored size and quadrant subdivisions', () => {
    expect(viewportPositionalShadowAtlas(4096, [1, 2, 3, 6])).toEqual({
      size: 4096,
      quadrantShadows: [1, 4, 16, 1024],
    });
  });

  it('keeps the Viewport defaults where the scene authors nothing (edge case)', () => {
    expect(viewportPositionalShadowAtlas(undefined, [])).toEqual({
      size: 2048,
      quadrantShadows: [4, 4, 16, 64],
    });
  });

  it('keeps the default for a value the setter refuses (error case)', () => {
    expect(viewportPositionalShadowAtlas(-1, [7, -1, 2.5, undefined])).toEqual({
      size: 2048,
      quadrantShadows: [4, 4, 16, 64],
    });
  });
});
