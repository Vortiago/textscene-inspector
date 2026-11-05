import { describe, expect, it } from 'vitest';
import { HAIRLINE_THICKNESS_PX, hairlineQuadStartPx } from './hairline';

describe('hairlineQuadStartPx', () => {
  // A two-point line at y 39 lights row 38, the pixel before the tie (renderer_canvas_cull.cpp:754-763).
  it('starts the quad half a pixel before the line, so it covers the row Godot lights', () => {
    expect(hairlineQuadStartPx(39)).toBe(38.5);
  });

  it('is one pixel thick, the default width of draw_line', () => {
    expect(HAIRLINE_THICKNESS_PX).toBe(1);
  });
});
