/**
 * Pins `Parallax2D::_update_scroll` to the numbers `pnpm ref:godot --mode 2d` measured at
 * 1152x648 with 40x40 children: each case names the top-left x Godot drew.
 */

import { describe, expect, it } from 'vitest';
import { parseParallax2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';
import { parallax2DCameraScreenOffset, parallax2DPosition } from './parallax2dScroll';
import type { ParallaxViewFraming } from '../parallaxbackground/parallaxScroll';

const VIEWPORT = { x: 1152, y: 648 };
const NO_OFFSET = { x: 0, y: 0 };
const UNIT_SCALE = { x: 1, y: 1 };

function positionOf(properties: Record<string, string>, screenOffset = NO_OFFSET, nodeScale = UNIT_SCALE) {
  const props = parseParallax2D(heading('Parallax2D', { name: 'P' }), properties);
  return parallax2DPosition(props, screenOffset, VIEWPORT, nodeScale);
}

describe('parallax2DPosition', () => {
  it('places the node at scroll_offset when the screen offset is 0', () => {
    // Godot: child at (0,0), scroll_offset (100, 20) -> (100, 20)
    expect(positionOf({ scroll_offset: 'Vector2(100, 20)' })).toEqual({ x: 100, y: 20 });
  });

  it('scales the screen offset by scroll_scale and follows the viewport', () => {
    // Godot: scroll_scale (0.5, 1), screen_offset (50, 0), child at x 100 -> 125
    expect(positionOf({ scroll_scale: 'Vector2(0.5, 1)' }, { x: 50, y: 0 }).x).toBe(25);
  });

  it('subtracts the screen offset when follow_viewport is false', () => {
    // Godot: same, follow_viewport = false -> 75
    expect(positionOf({ scroll_scale: 'Vector2(0.5, 1)', follow_viewport: 'false' }, { x: 50, y: 0 }).x).toBe(
      -25
    );
  });

  it('clamps the screen offset into the limits before scaling', () => {
    // Godot: limit_begin (60, -1e7), limit_end (2000, 1e7), child at x 300 -> 240; no offset gives 0 -> clamp 60.
    const clamped = positionOf(
      {
        limit_begin: 'Vector2(60, -10000000)',
        limit_end: 'Vector2(2000, 10000000)',
        scroll_scale: 'Vector2(1, 1)',
      },
      NO_OFFSET
    );
    expect(clamped.x).toBe(-60);
  });

  it('skips the clamp on an axis whose limits are narrower than the viewport', () => {
    // parallax_2d.cpp:112: begin <= end - viewport. 100 <= 200 - 1152 is false.
    const skipped = positionOf(
      { limit_begin: 'Vector2(100, -10000000)', limit_end: 'Vector2(200, 10000000)' },
      { x: 5, y: 0 }
    );
    expect(skipped.x).toBe(0);
  });

  it('wraps a repeating axis into [screen_offset - repeat_size, screen_offset]', () => {
    // Godot: scroll_offset (100, 0), repeat_size (200, 0): a child at x 300 draws at 200 and 400,
    // so the node sits at 200 - 300 = -100.
    expect(positionOf({ scroll_offset: 'Vector2(100, 0)', repeat_size: 'Vector2(200, 0)' }).x).toBe(-100);
  });

  it('stretches the repeat interval by the node scale', () => {
    // Godot: scale (0.5, 1), scroll_offset (100, 0), repeat_size (200, 0): fposmod(-100, 100) = 0 -> 0
    expect(
      positionOf({ scroll_offset: 'Vector2(100, 0)', repeat_size: 'Vector2(200, 0)' }, NO_OFFSET, {
        x: 0.5,
        y: 1,
      }).x
    ).toBe(0);
  });
});

describe('parallax2DCameraScreenOffset', () => {
  const view = (zoom: number): ParallaxViewFraming => ({
    // Camera2D at (776, 324) in a 1152x648 viewport: top-left = centre - size / (2 * zoom)
    topLeft: { x: 776 - 576 / zoom, y: 324 - 324 / zoom },
    size: VIEWPORT,
    zoom,
    centered: true,
  });

  it('is the view centre minus half the viewport size at zoom 1', () => {
    expect(parallax2DCameraScreenOffset(view(1))).toEqual({ x: 200, y: 0 });
  });

  it('does not divide the half viewport by the zoom', () => {
    // camera_2d.cpp:63: adj_screen_pos = camera_screen_center - screen_size * 0.5
    expect(parallax2DCameraScreenOffset(view(2))).toEqual({ x: 200, y: 0 });
  });
});
