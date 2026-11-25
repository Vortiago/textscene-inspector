import { describe, expect, it } from 'vitest';
import { sprite2DRectRegion } from './rectRegion';
import type { Sprite2DProperties } from './types';

const SIZE = { width: 64, height: 32 };

const sprite = (props: Partial<Sprite2DProperties> = {}) =>
  ({
    centered: true,
    offset: { x: 0, y: 0 },
    flip_h: false,
    flip_v: false,
    region_enabled: false,
    region_filter_clip_enabled: false,
    hframes: 1,
    vframes: 1,
    frame: 0,
    ...props,
  }) as Sprite2DProperties;

describe('sprite2DRectRegion', () => {
  it('centres the whole texture on the origin', () => {
    expect(sprite2DRectRegion(sprite(), SIZE)).toEqual({
      rect: { x: -32, y: -16, w: 64, h: 32 },
      source: { x: 0, y: 0, w: 64, h: 32 },
      clipUv: false,
    });
  });

  it('places the top-left corner at the offset when not centred', () => {
    expect(sprite2DRectRegion(sprite({ centered: false, offset: { x: 5, y: -3 } }), SIZE).rect).toEqual({
      x: 5,
      y: -3,
      w: 64,
      h: 32,
    });
  });

  it('negates the rect size of each flipped axis', () => {
    expect(sprite2DRectRegion(sprite({ flip_h: true, flip_v: true }), SIZE).rect).toEqual({
      x: -32,
      y: -16,
      w: -64,
      h: -32,
    });
  });

  it("takes the frame's cell of the grid as the source", () => {
    expect(sprite2DRectRegion(sprite({ hframes: 4, vframes: 2, frame: 5 }), SIZE).source).toEqual({
      x: 16,
      y: 16,
      w: 16,
      h: 16,
    });
  });

  it('clips the UVs of an enabled region that asks for it', () => {
    const region = sprite({
      region_enabled: true,
      region_rect: { x: 8, y: 4, width: 16, height: 8 },
      region_filter_clip_enabled: true,
    });

    expect(sprite2DRectRegion(region, SIZE)).toMatchObject({
      source: { x: 8, y: 4, w: 16, h: 8 },
      clipUv: true,
    });
  });

  it('clips no UVs while the region is off', () => {
    expect(sprite2DRectRegion(sprite({ region_filter_clip_enabled: true }), SIZE).clipUv).toBe(false);
  });
});
