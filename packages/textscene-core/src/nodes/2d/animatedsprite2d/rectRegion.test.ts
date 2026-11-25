import { describe, expect, it } from 'vitest';
import { animatedSprite2DRectRegion } from './rectRegion';
import type { AnimatedSprite2DProperties } from './types';

const SIZE = { width: 64, height: 32 };

const sprite = (props: Partial<AnimatedSprite2DProperties> = {}) =>
  ({
    centered: true,
    offset: { x: 0, y: 0 },
    flip_h: false,
    flip_v: false,
    ...props,
  }) as AnimatedSprite2DProperties;

describe('animatedSprite2DRectRegion', () => {
  it("centres the frame's whole texture on the origin", () => {
    expect(animatedSprite2DRectRegion(sprite(), SIZE)).toEqual({
      rect: { x: -32, y: -16, w: 64, h: 32 },
      source: { x: 0, y: 0, w: 64, h: 32 },
      clipUv: false,
    });
  });

  it('places the top-left corner at the offset when not centred', () => {
    expect(
      animatedSprite2DRectRegion(sprite({ centered: false, offset: { x: 3, y: -2 } }), SIZE).rect
    ).toEqual({
      x: 3,
      y: -2,
      w: 64,
      h: 32,
    });
  });

  it('flips by a negative size', () => {
    expect(animatedSprite2DRectRegion(sprite({ flip_h: true, flip_v: true }), SIZE).rect).toEqual({
      x: -32,
      y: -16,
      w: -64,
      h: -32,
    });
  });
});
