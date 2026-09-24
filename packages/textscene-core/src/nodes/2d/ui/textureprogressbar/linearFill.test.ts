/**
 * `linearProgressDraw` against Godot 4.6.3 (`texture_progress_bar.cpp:445-482`).
 * Worked by hand: texture (100, 20), `progress_offset` (5, 2), ratio 0.4.
 */
import { describe, expect, it } from 'vitest';
import {
  linearProgressDraw,
  FILL_LEFT_TO_RIGHT,
  FILL_RIGHT_TO_LEFT,
  FILL_TOP_TO_BOTTOM,
  FILL_BOTTOM_TO_TOP,
  FILL_BILINEAR_LEFT_AND_RIGHT,
  FILL_BILINEAR_TOP_AND_BOTTOM,
} from './linearFill';

const TEXTURE_SIZE = { x: 100, y: 20 };
const OFFSET = { x: 5, y: 2 };
const RATIO = 0.4;

describe('linearProgressDraw (texture_progress_bar.cpp:445-482)', () => {
  it('FILL_LEFT_TO_RIGHT crops the left 40% and places it at progress_offset', () => {
    expect(linearProgressDraw(FILL_LEFT_TO_RIGHT, RATIO, TEXTURE_SIZE, OFFSET)).toEqual({
      region: { x: 0, y: 0, w: 40, h: 20 },
      offset: { x: 5, y: 2 },
      size: { x: 40, y: 20 },
    });
  });

  it('FILL_RIGHT_TO_LEFT crops the right 40% and offsets the dest by the same amount', () => {
    expect(linearProgressDraw(FILL_RIGHT_TO_LEFT, RATIO, TEXTURE_SIZE, OFFSET)).toEqual({
      region: { x: 60, y: 0, w: 40, h: 20 },
      offset: { x: 65, y: 2 },
      size: { x: 40, y: 20 },
    });
  });

  it('FILL_TOP_TO_BOTTOM crops the top 40%', () => {
    expect(linearProgressDraw(FILL_TOP_TO_BOTTOM, RATIO, TEXTURE_SIZE, OFFSET)).toEqual({
      region: { x: 0, y: 0, w: 100, h: 8 },
      offset: { x: 5, y: 2 },
      size: { x: 100, y: 8 },
    });
  });

  it('FILL_BOTTOM_TO_TOP crops the bottom 40%', () => {
    expect(linearProgressDraw(FILL_BOTTOM_TO_TOP, RATIO, TEXTURE_SIZE, OFFSET)).toEqual({
      region: { x: 0, y: 12, w: 100, h: 8 },
      offset: { x: 5, y: 14 },
      size: { x: 100, y: 8 },
    });
  });

  it('FILL_BILINEAR_LEFT_AND_RIGHT crops a centred 40%-wide band', () => {
    expect(linearProgressDraw(FILL_BILINEAR_LEFT_AND_RIGHT, RATIO, TEXTURE_SIZE, OFFSET)).toEqual({
      region: { x: 30, y: 0, w: 40, h: 20 },
      offset: { x: 35, y: 2 },
      size: { x: 40, y: 20 },
    });
  });

  it('FILL_BILINEAR_TOP_AND_BOTTOM crops a centred 40%-tall band', () => {
    expect(linearProgressDraw(FILL_BILINEAR_TOP_AND_BOTTOM, RATIO, TEXTURE_SIZE, OFFSET)).toEqual({
      region: { x: 0, y: 6, w: 100, h: 8 },
      offset: { x: 5, y: 8 },
      size: { x: 100, y: 8 },
    });
  });

  it('an out-of-range/radial fill_mode returns null (never reached from the caller in practice)', () => {
    expect(linearProgressDraw(4, RATIO, TEXTURE_SIZE, OFFSET)).toBeNull();
    expect(linearProgressDraw(undefined, RATIO, TEXTURE_SIZE, OFFSET)).toBeNull();
  });
});
