import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import {
  hsvToRgb,
  invertRgb,
  extractHsv,
  colorPickerScale,
  colorPickerRows,
  colorPickerMinimumSize,
  svAndHueRects,
  svSquareCursorPosition,
  hueIndicatorY,
} from './nativeSolver';

const THEME = nativeTheme(1);
const CTX: SolveContext = { theme: THEME, measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = { name: 'P', type: 'ColorPicker', children: [], properties };
  return { ...emptySolveNode(), path: 'P', node: tscnNode };
}

describe('hsvToRgb', () => {
  // core/math/color.cpp:182-227 (Color::set_hsv), case i:0 h in [0,1/6).
  it('is pure red at h=0, s=1, v=1', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('is achromatic grey at s=0, independent of h', () => {
    expect(hsvToRgb(0.42, 0, 0.5)).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
  });

  it('wraps h past 1 the same as Math::fmod on a negative-safe range', () => {
    expect(hsvToRgb(1, 1, 1)).toEqual(hsvToRgb(0, 1, 1));
  });
});

describe('invertRgb', () => {
  it('flips rgb and leaves alpha — core/math/color.h Color::inverted()', () => {
    expect(invertRgb({ r: 0.2, g: 0.4, b: 0.6, a: 0.5 })).toEqual({ r: 0.8, g: 0.6, b: 0.4, a: 0.5 });
  });
});

describe('extractHsv', () => {
  it('matches Color::get_h/get_s/get_v directly for a non-overbright colour', () => {
    // color_picker.cpp:593-602: multiplier is 1 for any channel <= 1, so
    // color_normalized === color and this is the plain HSV extraction.
    const { h, s, v } = extractHsv({ r: 1, g: 0, b: 0, a: 1 });
    expect(h).toBeCloseTo(0);
    expect(s).toBeCloseTo(1);
    expect(v).toBeCloseTo(1);
  });

  it('normalises an overbright colour before extracting h/s/v — color_picker.cpp:593-602', () => {
    // r=2 (linear-equivalent overbright red): multiplier > 1, so v settles
    // back to 1 after the srgb round-trip, not 2.
    const { s, v } = extractHsv({ r: 2, g: 0, b: 0, a: 1 });
    expect(s).toBeCloseTo(1, 2);
    expect(v).toBeCloseTo(1, 2);
  });

  it('is achromatic (h=0) for pure black', () => {
    expect(extractHsv({ r: 0, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 0, v: 0 });
  });
});

describe('colorPickerScale', () => {
  it('is 1 at the default theme (separation=4)', () => {
    expect(colorPickerScale(THEME)).toBe(1);
  });

  it('scales proportionally to a wider separation', () => {
    expect(colorPickerScale({ separation: 8 })).toBe(2);
  });
});

describe('colorPickerRows', () => {
  it('sizes the shape row from sv_width/sv_height/h_width at scale 1 — default_theme.cpp:1077-1079', () => {
    const rows = colorPickerRows(400, THEME, 0);
    expect(rows.shape).toEqual({ x: 0, y: 0, w: 400, h: 256 });
    expect(rows.sample).toEqual({ x: 0, y: 260, w: 400, h: 24 });
  });

  it('floors the shape row at its own minimum when the solved width is narrower', () => {
    const rows = colorPickerRows(50, THEME, 0);
    expect(rows.shape!.w).toBe(290); // 256 + 4 + 30
  });

  it('draws no shape row for any picker_shape but SHAPE_HSV_RECTANGLE, keeping the row separation gap', () => {
    const wheel = colorPickerRows(400, THEME, 1);
    expect(wheel.shape).toBeNull();
    expect(wheel.sample).toEqual({ x: 0, y: 4, w: 400, h: 24 });
  });

  it('draws no shape row for SHAPE_NONE (4) — matches Godot exactly, not a gap', () => {
    expect(colorPickerRows(400, THEME, 4).shape).toBeNull();
  });
});

describe('colorPickerMinimumSize', () => {
  it('sums the shape row and sample row at the default picker_shape', () => {
    expect(colorPickerMinimumSize(node({}), CTX)).toEqual({ x: 290, y: 284 });
  });

  it('drops the shape row contribution once picker_shape selects an undrawn shape', () => {
    expect(colorPickerMinimumSize(node({ pickerShape: 2 }), CTX)).toEqual({ x: 0, y: 28 });
  });
});

describe('svAndHueRects', () => {
  it('splits the shape row into sv_square and hue_slider by h_width + separation', () => {
    const { svSquare, hueSlider } = svAndHueRects({ x: 0, y: 0, w: 400, h: 256 }, THEME);
    expect(svSquare).toEqual({ x: 0, y: 0, w: 366, h: 256 }); // 400 - 4 - 30
    expect(hueSlider).toEqual({ x: 370, y: 0, w: 30, h: 256 });
  });
});

describe('svSquareCursorPosition', () => {
  const SQUARE = { x: 10, y: 20, w: 100, h: 100 };

  it('places the cursor at s along x and (1-v) along y — color_picker_shape.cpp:259-261', () => {
    expect(svSquareCursorPosition(SQUARE, 0.5, 0.25)).toEqual({ x: 60, y: 95 });
  });

  it('clamps to the square bounds at s=0, v=1', () => {
    expect(svSquareCursorPosition(SQUARE, 0, 1)).toEqual({ x: 10, y: 20 });
  });

  it('clamps to the square bounds at s=1, v=0', () => {
    expect(svSquareCursorPosition(SQUARE, 1, 0)).toEqual({ x: 110, y: 120 });
  });
});

describe('hueIndicatorY', () => {
  it('is proportional to h across the slider height — color_picker_shape.cpp:431', () => {
    expect(hueIndicatorY(256, 0.5)).toBe(128);
  });

  it('is 0 at h=0', () => {
    expect(hueIndicatorY(256, 0)).toBe(0);
  });
});
