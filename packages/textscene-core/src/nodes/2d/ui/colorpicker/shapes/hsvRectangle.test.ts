import { describe, expect, it } from 'vitest';
import { HSV_RECTANGLE } from './hsvRectangle';
import { COLOR_HUE_STOPS } from '../svGradient';

const SPLIT = { area: { x: 10, y: 20, w: 100, h: 100 }, slider: { x: 114, y: 20, w: 30, h: 256 } };
const OKHSL = { h: 0, s: 0, l: 0 };

describe('HSV_RECTANGLE', () => {
  it('draws the SV square over the whole area at the hue, with no shader fill', () => {
    const drawing = HSV_RECTANGLE.draw(SPLIT, { hsv: { h: 0.25, s: 0.5, v: 0.5 }, okhsl: OKHSL });
    expect(drawing.svSquare).toEqual({ rect: SPLIT.area, hue: 0.25 });
    expect(drawing.fill).toBeNull();
  });

  it('places the cursor at s along x and (1 - v) along y: color_picker_shape.cpp:259-261', () => {
    const drawing = HSV_RECTANGLE.draw(SPLIT, { hsv: { h: 0, s: 0.5, v: 0.25 }, okhsl: OKHSL });
    expect(drawing.cursors).toEqual([{ centre: { x: 60, y: 95 }, hasBackground: true }]);
  });

  it('clamps the cursor to the square at s = 1 and v = 0', () => {
    const drawing = HSV_RECTANGLE.draw(SPLIT, { hsv: { h: 0, s: 1, v: 0 }, okhsl: OKHSL });
    expect(drawing.cursors[0]!.centre).toEqual({ x: 110, y: 120 });
  });

  it('draws the color_hue rainbow in hue_slider, with its line at int(size.y * h): color_picker_shape.cpp:425-433', () => {
    const drawing = HSV_RECTANGLE.draw(SPLIT, { hsv: { h: 0.6, s: 1, v: 1 }, okhsl: OKHSL });
    expect(drawing.slider!.stops).toBe(COLOR_HUE_STOPS);
    expect(drawing.slider!.lineY).toBe(153);
  });

  it('draws the line in the inverted full hue', () => {
    const drawing = HSV_RECTANGLE.draw(SPLIT, { hsv: { h: 0, s: 0.2, v: 0.3 }, okhsl: OKHSL });
    expect(drawing.slider!.lineColor).toEqual({ r: 0, g: 1, b: 1, a: 1 });
  });

  it('shows shape_rect on btn_shape (color_picker_shape.h:108)', () => {
    expect(HSV_RECTANGLE.icon).toBe('shape_rect');
  });
});
