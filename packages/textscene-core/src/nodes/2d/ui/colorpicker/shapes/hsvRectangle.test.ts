import { describe, expect, it } from 'vitest';
import { HSV_RECTANGLE } from './hsvRectangle';
import { COLOR_HUE_STOPS } from '../svGradient';
import { controlTree, drawControl } from './shapeDrawing.testkit';

const SQUARE = { x: 0, y: 0, w: 100, h: 100 };
const SLIDER = { x: 0, y: 0, w: 30, h: 256 };
const OKHSL = { h: 0, s: 0, l: 0 };

describe('HSV_RECTANGLE', () => {
  it('adds sv_square, then hue_slider (color_picker_shape.cpp:395-415)', () => {
    expect(controlTree(HSV_RECTANGLE)).toEqual(['sv_square', 'hue_slider']);
  });

  it('expands sv_square across, so it takes what hue_slider leaves', () => {
    expect(HSV_RECTANGLE.controls.map((c) => [c.minimum, c.isExpanding ?? false])).toEqual([
      ['area', true],
      ['slider', false],
    ]);
  });

  it('draws the SV square over all of sv_square at the hue, with no shader fill', () => {
    const drawing = drawControl(HSV_RECTANGLE, 'sv_square', SQUARE, {
      hsv: { h: 0.25, s: 0.5, v: 0.5 },
      okhsl: OKHSL,
    });
    expect(drawing.svSquare).toEqual({ rect: SQUARE, hue: 0.25 });
    expect(drawing.fill).toBeNull();
  });

  it('places the cursor at s along x and (1 - v) along y: color_picker_shape.cpp:259-261', () => {
    const drawing = drawControl(HSV_RECTANGLE, 'sv_square', SQUARE, {
      hsv: { h: 0, s: 0.5, v: 0.25 },
      okhsl: OKHSL,
    });
    expect(drawing.cursors).toEqual([{ centre: { x: 50, y: 75 }, hasBackground: true }]);
  });

  it('clamps the cursor to the square at s = 1 and v = 0', () => {
    const drawing = drawControl(HSV_RECTANGLE, 'sv_square', SQUARE, {
      hsv: { h: 0, s: 1, v: 0 },
      okhsl: OKHSL,
    });
    expect(drawing.cursors[0]!.centre).toEqual({ x: 100, y: 100 });
  });

  it('draws the color_hue rainbow in hue_slider, with its line at int(size.y * h): color_picker_shape.cpp:425-433', () => {
    const drawing = drawControl(HSV_RECTANGLE, 'hue_slider', SLIDER, {
      hsv: { h: 0.6, s: 1, v: 1 },
      okhsl: OKHSL,
    });
    expect(drawing.slider!.stops).toBe(COLOR_HUE_STOPS);
    expect(drawing.slider!.lineY).toBe(153);
  });

  it('draws the line in the inverted full hue', () => {
    const drawing = drawControl(HSV_RECTANGLE, 'hue_slider', SLIDER, {
      hsv: { h: 0, s: 0.2, v: 0.3 },
      okhsl: OKHSL,
    });
    expect(drawing.slider!.lineColor).toEqual({ r: 0, g: 1, b: 1, a: 1 });
  });

  it('shows shape_rect on btn_shape (color_picker_shape.h:108)', () => {
    expect(HSV_RECTANGLE.icon).toBe('shape_rect');
  });
});
