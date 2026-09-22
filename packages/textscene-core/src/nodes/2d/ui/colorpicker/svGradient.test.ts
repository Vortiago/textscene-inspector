import { describe, expect, it } from 'vitest';
import { svSquareBaseLayer, svSquareHueLayer, hueStripGeometry, horizontalStripGeometry, linearizeStops } from './svGradient';

describe('linearizeStops', () => {
  // core/math/color.h:192-198, Color::srgb_to_linear: c < 0.04045 ? c/12.92 : pow((c+0.055)/1.055, 2.4).
  it('converts each stop channel sRGB to linear, keeping alpha untouched', () => {
    const [stop] = linearizeStops([{ r: 1, g: 0, b: 0.5, a: 0.25 }]);
    expect(stop!.r).toBeCloseTo(1, 6);
    expect(stop!.g).toBeCloseTo(0, 6);
    expect(stop!.b).toBeCloseTo(0.21404, 5);
    expect(stop!.a).toBe(0.25);
  });

  it('is 0 at 0 and preserves stop order/count', () => {
    const stops = linearizeStops([{ r: 0, g: 0, b: 0, a: 1 }, { r: 1, g: 1, b: 1, a: 1 }]);
    expect(stops).toHaveLength(2);
    expect(stops[0]).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('svSquareBaseLayer', () => {
  it('is white at the top corners and black at the bottom — color_picker_shape.cpp:243-249', () => {
    const g = svSquareBaseLayer(100, 50);
    // top-left, top-right, bottom-right, bottom-left, 4 floats each.
    expect(g.colors.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(g.colors.slice(4, 8)).toEqual([1, 1, 1, 1]);
    expect(g.colors.slice(8, 12)).toEqual([0, 0, 0, 1]);
    expect(g.colors.slice(12, 16)).toEqual([0, 0, 0, 1]);
  });

  it('places the bottom-right vertex at (w, -h) — +Y down, flipped for three-space', () => {
    const g = svSquareBaseLayer(100, 50);
    expect(g.positions.slice(6, 9)).toEqual([100, -50, 0]);
  });
});

describe('svSquareHueLayer', () => {
  it('is transparent at the left edge and opaque red at the right edge for hue=0', () => {
    const g = svSquareHueLayer(100, 50, 0);
    // top-left: full hue colour, alpha 0.
    expect(g.colors.slice(0, 4)).toEqual([1, 0, 0, 0]);
    // top-right: full hue colour, alpha 1.
    expect(g.colors.slice(4, 8)).toEqual([1, 0, 0, 1]);
    // bottom-right: black (v=0), alpha 1.
    expect(g.colors.slice(8, 12)).toEqual([0, 0, 0, 1]);
    // bottom-left: black, alpha 0.
    expect(g.colors.slice(12, 16)).toEqual([0, 0, 0, 0]);
  });
});

describe('hueStripGeometry', () => {
  it('has 7 stops (14 vertices) and 6 quads (12 indices)', () => {
    const g = hueStripGeometry(30, 256);
    expect(g.positions).toHaveLength(7 * 2 * 3);
    expect(g.colors).toHaveLength(7 * 2 * 4);
    expect(g.indices).toHaveLength(6 * 2 * 3);
  });

  it('starts red at h=0 and returns to red at h=1 — default_theme.cpp:1104-1128', () => {
    const g = hueStripGeometry(30, 256);
    expect(g.colors.slice(0, 4)).toEqual([1, 0, 0, 1]);
    const lastStop = g.colors.length - 8;
    expect(g.colors.slice(lastStop, lastStop + 4)).toEqual([1, 0, 0, 1]);
  });

  it('runs top-to-bottom across the full height, y negated for three-space', () => {
    const g = hueStripGeometry(30, 256);
    const lastY = g.positions[g.positions.length - 2];
    expect(lastY).toBe(-256);
  });
});

describe('horizontalStripGeometry', () => {
  it('runs left-to-right across the full width for a 2-stop gradient', () => {
    const g = horizontalStripGeometry(100, 16, [
      { r: 0, g: 0, b: 0, a: 1 },
      { r: 1, g: 0, b: 0, a: 1 },
    ]);
    // top-left, bottom-left: black.
    expect(g.colors.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(g.colors.slice(4, 8)).toEqual([0, 0, 0, 1]);
    // top-right, bottom-right: red, at x=100.
    expect(g.colors.slice(8, 12)).toEqual([1, 0, 0, 1]);
    expect(g.positions.slice(6, 9)).toEqual([100, 0, 0]);
    expect(g.positions.slice(9, 12)).toEqual([100, -16, 0]);
    expect(g.indices).toEqual([0, 1, 2, 1, 3, 2]);
  });

  it('places an interior stop at its own fraction of the width for a 3-stop gradient', () => {
    const g = horizontalStripGeometry(100, 16, [
      { r: 0, g: 0, b: 0, a: 1 },
      { r: 1, g: 1, b: 1, a: 1 },
      { r: 0, g: 0, b: 1, a: 1 },
    ]);
    // 3 stops = 6 vertices, 2 quads = 12 indices.
    expect(g.positions).toHaveLength(6 * 3);
    expect(g.indices).toHaveLength(2 * 6);
    // Middle stop's top vertex sits at x=50.
    expect(g.positions.slice(6, 9)).toEqual([50, 0, 0]);
    expect(g.colors.slice(8, 12)).toEqual([1, 1, 1, 1]);
  });
});
