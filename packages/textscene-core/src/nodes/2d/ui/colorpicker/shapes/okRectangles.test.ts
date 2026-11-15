import { describe, expect, it } from 'vitest';
import { OK_HS_RECTANGLE } from './okHsRectangle';
import { OK_HL_RECTANGLE } from './okHlRectangle';
import { okhslToSrgb } from '../okhsl';
import { controlTree, drawControl } from './shapeDrawing.testkit';

const SQUARE = { x: 0, y: 0, w: 258, h: 256 };
const SLIDER = { x: 0, y: 0, w: 30, h: 256 };
const COLOR = { hsv: { h: 0, s: 0, v: 0 }, okhsl: { h: 0.5, s: 0.25, l: 0.75 } };

describe('the OK rectangles', () => {
  it('add rectangle_margin holding square and square_overlay, then value_slider (color_picker_shape.cpp:473-504)', () => {
    for (const variant of [OK_HS_RECTANGLE, OK_HL_RECTANGLE]) {
      expect(controlTree(variant)).toEqual([
        { rectangle_margin: ['square', 'square_overlay'] },
        'value_slider',
      ]);
    }
  });

  it('make rectangle_margin a MarginContainer that expands across', () => {
    const margin = OK_HS_RECTANGLE.controls[0]!;
    expect([margin.type, margin.minimum, margin.isExpanding]).toEqual(['MarginContainer', 'area', true]);
  });
});

describe('OK_HS_RECTANGLE', () => {
  it('fills the square through the OK HS shader at uniform ok_hsl_l (color_picker_shape.cpp:525-529)', () => {
    const drawing = drawControl(OK_HS_RECTANGLE, 'square', SQUARE, COLOR);
    expect(drawing.fill!.rect).toEqual(SQUARE);
    expect(drawing.fill!.fragment.name).toBe('ok-hs-rectangle');
    expect(drawing.fill!.uniforms).toEqual({ ok_hsl_l: 0.75 });
  });

  it('puts the cursor at ok_hsl_h across and 1 - ok_hsl_s down (:546-555)', () => {
    const drawing = drawControl(OK_HS_RECTANGLE, 'square_overlay', SQUARE, COLOR);
    expect(drawing.cursors).toEqual([{ centre: { x: 129, y: 192 }, hasBackground: true }]);
  });

  it('runs the slider over l at the current h and s, with its line at 1 - l (:568-600)', () => {
    const drawing = drawControl(OK_HS_RECTANGLE, 'value_slider', SLIDER, COLOR);
    expect(drawing.slider!.stops).toEqual([
      okhslToSrgb(0.5, 0.25, 1),
      okhslToSrgb(0.5, 0.25, 0.5),
      okhslToSrgb(0.5, 0.25, 0),
    ]);
    expect(drawing.slider!.lineY).toBe(64);
  });

  it('shows shape_rect on btn_shape (color_picker_shape.h:139)', () => {
    expect(OK_HS_RECTANGLE.icon).toBe('shape_rect');
  });
});

describe('OK_HL_RECTANGLE', () => {
  it('fills the square through the OK HL shader at uniform ok_hsl_s (color_picker_shape.cpp:637-641)', () => {
    const drawing = drawControl(OK_HL_RECTANGLE, 'square', SQUARE, COLOR);
    expect(drawing.fill!.fragment.name).toBe('ok-hl-rectangle');
    expect(drawing.fill!.uniforms).toEqual({ ok_hsl_s: 0.25 });
  });

  it('puts the cursor at ok_hsl_h across and 1 - ok_hsl_l down (:626-635)', () => {
    const drawing = drawControl(OK_HL_RECTANGLE, 'square_overlay', SQUARE, COLOR);
    expect(drawing.cursors).toEqual([{ centre: { x: 129, y: 64 }, hasBackground: true }]);
  });

  it('runs the slider over s at the current h and l, with its line at 1 - s (:654-686)', () => {
    const drawing = drawControl(OK_HL_RECTANGLE, 'value_slider', SLIDER, COLOR);
    expect(drawing.slider!.stops).toEqual([
      okhslToSrgb(0.5, 1, 0.75),
      okhslToSrgb(0.5, 0.5, 0.75),
      okhslToSrgb(0.5, 0, 0.75),
    ]);
    expect(drawing.slider!.lineY).toBe(192);
  });

  it('draws the line in the inverted from_ok_hsl(h, 1, l) (:684-686)', () => {
    const drawing = drawControl(OK_HL_RECTANGLE, 'value_slider', SLIDER, COLOR);
    const full = okhslToSrgb(0.5, 1, 0.75);
    expect(drawing.slider!.lineColor).toEqual({ r: 1 - full.r, g: 1 - full.g, b: 1 - full.b, a: 1 });
  });

  it('shows shape_rect on btn_shape (color_picker_shape.h:164)', () => {
    expect(OK_HL_RECTANGLE.icon).toBe('shape_rect');
  });
});
