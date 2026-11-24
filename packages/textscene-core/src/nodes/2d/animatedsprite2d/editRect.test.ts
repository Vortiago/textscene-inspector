import { describe, expect, it } from 'vitest';
import { animatedSprite2DEditRect } from './editRect';

describe('animatedSprite2DEditRect', () => {
  it('has no rect without a frame texture', () => {
    expect(animatedSprite2DEditRect(undefined, true, { x: 0, y: 0 })).toBeNull();
  });

  it('centres the frame and keeps fractions', () => {
    expect(animatedSprite2DEditRect({ width: 15, height: 9 }, true, { x: 1, y: 0 })).toEqual({
      x: -6.5,
      y: -4.5,
      w: 15,
      h: 9,
    });
  });
});
