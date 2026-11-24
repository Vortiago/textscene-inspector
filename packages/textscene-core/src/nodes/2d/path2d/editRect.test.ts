import { describe, expect, it } from 'vitest';
import { path2DEditRect } from './editRect';

describe('path2DEditRect', () => {
  it('has no rect for no points', () => {
    expect(path2DEditRect([])).toBeNull();
  });

  it('takes a lone point as a rect of no size', () => {
    expect(path2DEditRect([{ position: { x: 3, y: 4 }, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } }])).toEqual({
      x: 3,
      y: 4,
      w: 0,
      h: 0,
    });
  });
});
