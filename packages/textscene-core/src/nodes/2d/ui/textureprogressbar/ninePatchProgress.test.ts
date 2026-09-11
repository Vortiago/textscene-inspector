/**
 * `drawNinePatchStretched` vs Godot 4.6.3 (`texture_progress_bar.cpp:257-425`).
 * Worked by hand from the source's own formulas — texture (64, 16), stretch
 * margin 4px every side, control (100, 20 or 32) unless noted.
 */
import { describe, expect, it } from 'vitest';
import {
  drawNinePatchStretched,
  FILL_LEFT_TO_RIGHT,
  FILL_RIGHT_TO_LEFT,
  FILL_BILINEAR_LEFT_AND_RIGHT,
} from './ninePatchProgress';

const TEXTURE_SIZE = { x: 64, y: 16 };
const MARGIN = { left: 4, top: 4, right: 4, bottom: 4 };

describe('drawNinePatchStretched (texture_progress_bar.cpp:257-425)', () => {
  it('ratio 1.0 (under/over) never enters the partial-fill branch: full src, full dst, raw margins', () => {
    const draw = drawNinePatchStretched(TEXTURE_SIZE, MARGIN, FILL_LEFT_TO_RIGHT, 1.0, { x: 100, y: 32 }, null);
    expect(draw).toEqual({
      srcOffset: { x: 0, y: 0 },
      srcSize: { x: 64, y: 16 },
      dstOffset: { x: 0, y: 0 },
      dstSize: { x: 100, y: 32 },
      margin: { left: 4, top: 4, right: 4, bottom: 4 },
    });
  });

  it('a progress_offset shifts dstOffset at ratio 1.0 (:421-423, progress only)', () => {
    const draw = drawNinePatchStretched(TEXTURE_SIZE, MARGIN, FILL_LEFT_TO_RIGHT, 1.0, { x: 100, y: 32 }, { x: 1, y: 2 });
    expect(draw.dstOffset).toEqual({ x: 1, y: 2 });
  });

  it('FILL_LEFT_TO_RIGHT at ratio 0.5 shrinks the source window from the RIGHT and floors bottomright to 0', () => {
    const draw = drawNinePatchStretched(TEXTURE_SIZE, MARGIN, FILL_LEFT_TO_RIGHT, 0.5, { x: 100, y: 20 }, null);
    expect(draw).toEqual({
      srcOffset: { x: 0, y: 0 },
      srcSize: { x: 32, y: 16 },
      dstOffset: { x: 0, y: 0 },
      dstSize: { x: 50, y: 20 },
      margin: { left: 4, top: 4, right: 0, bottom: 4 },
    });
  });

  it('FILL_RIGHT_TO_LEFT at ratio 0.5 mirrors the same shrink from the source\'s own right edge', () => {
    const draw = drawNinePatchStretched(TEXTURE_SIZE, MARGIN, FILL_RIGHT_TO_LEFT, 0.5, { x: 100, y: 20 }, null);
    expect(draw).toEqual({
      srcOffset: { x: 32, y: 0 },
      srcSize: { x: 32, y: 16 },
      dstOffset: { x: 50, y: 0 },
      dstSize: { x: 50, y: 20 },
      // The shared middle/last-section math (`:346-351`) reduces
      // `lastSectionSize` to 0 regardless of which raw margin fed it; FILL_RIGHT_TO_LEFT's
      // own assignment (`:366-367`) puts that reduced value on `topleft`, not
      // `bottomright` — so `margin.left`, not `.right`, is the one that drops.
      margin: { left: 0, top: 4, right: 4, bottom: 4 },
    });
  });

  it('FILL_BILINEAR_LEFT_AND_RIGHT at ratio 0.5 shrinks the source symmetrically from its own centre', () => {
    const draw = drawNinePatchStretched(TEXTURE_SIZE, MARGIN, FILL_BILINEAR_LEFT_AND_RIGHT, 0.5, { x: 100, y: 20 }, null);
    expect(draw.srcOffset.x).toBeCloseTo(16.7826086957, 9);
    expect(draw.srcSize.x).toBeCloseTo(30.4347826087, 9);
    expect(draw.dstOffset.x).toBeCloseTo(25, 9);
    expect(draw.dstSize.x).toBeCloseTo(50, 9);
    expect(draw.margin.left).toBeCloseTo(0, 9);
    expect(draw.margin.right).toBeCloseTo(0, 9);
    // Y untouched by an X-axis fill mode.
    expect(draw.margin.top).toBe(4);
    expect(draw.margin.bottom).toBe(4);
  });
});
