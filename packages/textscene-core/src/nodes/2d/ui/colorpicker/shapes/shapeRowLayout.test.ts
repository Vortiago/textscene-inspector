import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../../r3f/controls/native/nativeTheme';
import {
  CIRCLE_LAYOUT,
  RECTANGLE_LAYOUT,
  WHEEL_LAYOUT,
  shapeRowMinWidth,
  shapeRowSplit,
} from './shapeRowLayout';

const THEME = nativeTheme(1);
/** The `shape_container` of a 300 px picker: 300 less `internal_margin`'s 4 px on each side. */
const ROW = { x: 0, y: 0, w: 292, h: 256 };

describe('shapeRowMinWidth', () => {
  it('is sv_width alone for the wheel', () => {
    expect(shapeRowMinWidth(THEME, WHEEL_LAYOUT)).toBe(256);
  });

  it('is sv_width, separation and h_width for a circle and a rectangle', () => {
    expect(shapeRowMinWidth(THEME, CIRCLE_LAYOUT)).toBe(290);
    expect(shapeRowMinWidth(THEME, RECTANGLE_LAYOUT)).toBe(290);
  });

  it('scales sv_width, h_width and separation with the theme scale (default_theme.cpp:1077-1079)', () => {
    expect(shapeRowMinWidth(nativeTheme(1.5), CIRCLE_LAYOUT)).toBe(384 + 6 + 45); // `separation` is round(4 * 1.5) too.
  });
});

describe('shapeRowSplit', () => {
  it('centres the wheel in the row: Godot draws it at x 26..282 in a 300 px picker at x 4', () => {
    const split = shapeRowSplit(ROW, THEME, WHEEL_LAYOUT, false);
    expect(split.area).toEqual({ x: 18, y: 0, w: 256, h: 256 });
    expect(split.slider).toBeNull();
  });

  it('centres a circle and its value slider: Godot draws them at x 315..571 and 575..605 in a picker at x 310', () => {
    const split = shapeRowSplit(ROW, THEME, CIRCLE_LAYOUT, false);
    expect(split.area).toEqual({ x: 1, y: 0, w: 256, h: 256 });
    expect(split.slider).toEqual({ x: 261, y: 0, w: 30, h: 256 });
  });

  it('stretches an OK rectangle beside its h_width slider', () => {
    const split = shapeRowSplit(ROW, THEME, RECTANGLE_LAYOUT, false);
    expect(split.area).toEqual({ x: 0, y: 0, w: 258, h: 256 });
    expect(split.slider).toEqual({ x: 262, y: 0, w: 30, h: 256 });
  });

  it('splits the HSV rectangle the same way', () => {
    const split = shapeRowSplit({ x: 0, y: 0, w: 400, h: 256 }, THEME, RECTANGLE_LAYOUT, false);
    expect(split.area).toEqual({ x: 0, y: 0, w: 366, h: 256 });
    expect(split.slider).toEqual({ x: 370, y: 0, w: 30, h: 256 });
  });

  it('places the split at the row position', () => {
    const split = shapeRowSplit({ ...ROW, x: 10, y: 20 }, THEME, CIRCLE_LAYOUT, false);
    expect(split.area).toEqual({ x: 11, y: 20, w: 256, h: 256 });
  });

  it('mirrors a circle and its slider in a right-to-left layout (box_container.cpp:184-192)', () => {
    const split = shapeRowSplit(ROW, THEME, CIRCLE_LAYOUT, true);
    expect(split.slider).toEqual({ x: 1, y: 0, w: 30, h: 256 });
    expect(split.area).toEqual({ x: 35, y: 0, w: 256, h: 256 });
  });

  it('mirrors the HSV rectangle in a right-to-left layout: hue(30) at 0, sep(4), sv(366) at 34', () => {
    const split = shapeRowSplit({ x: 0, y: 0, w: 400, h: 256 }, THEME, RECTANGLE_LAYOUT, true);
    expect(split.slider).toEqual({ x: 0, y: 0, w: 30, h: 256 });
    expect(split.area).toEqual({ x: 34, y: 0, w: 366, h: 256 });
  });

  it('mirrors an OK rectangle in a right-to-left layout', () => {
    const split = shapeRowSplit(ROW, THEME, RECTANGLE_LAYOUT, true);
    expect(split.slider).toEqual({ x: 0, y: 0, w: 30, h: 256 });
    expect(split.area).toEqual({ x: 34, y: 0, w: 258, h: 256 });
  });
});
