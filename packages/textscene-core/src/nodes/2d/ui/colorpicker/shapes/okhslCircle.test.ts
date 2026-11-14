import { describe, expect, it } from 'vitest';
import { OKHSL_CIRCLE } from './okhslCircle';
import { okhslToSrgb } from '../okhsl';
import { controlTree, drawControl } from './shapeDrawing.testkit';

const CIRCLE = { x: 0, y: 0, w: 256, h: 256 };
const SLIDER = { x: 0, y: 0, w: 30, h: 256 };
const HSV = { h: 0, s: 0, v: 0 };

describe('OKHSL_CIRCLE', () => {
  it('adds circle holding circle_overlay, then value_slider (color_picker_shape.cpp:875-901)', () => {
    expect(controlTree(OKHSL_CIRCLE)).toEqual([{ circle: ['circle_overlay'] }, 'value_slider']);
  });

  it('fills the circle through the OK colour circle shader at uniform ok_hsl_l (color_picker_shape.cpp:1036-1040)', () => {
    const drawing = drawControl(OKHSL_CIRCLE, 'circle', CIRCLE, {
      hsv: HSV,
      okhsl: { h: 0.1, s: 0.2, l: 0.3 },
    });
    expect(drawing.fill!.fragment.name).toBe('okhsl-circle');
    expect(drawing.fill!.fragment.usesOkColor).toBe(true);
    expect(drawing.fill!.uniforms).toEqual({ ok_hsl_l: 0.3 });
  });

  it('puts the cursor at ok_hsl_h and ok_hsl_s, not the HSV h and s (:1042-1045)', () => {
    const drawing = drawControl(OKHSL_CIRCLE, 'circle_overlay', CIRCLE, {
      hsv: { h: 0.5, s: 1, v: 1 },
      okhsl: { h: 0.75, s: 1, l: 0.5 },
    });
    expect(drawing.cursors[0]!.centre.x).toBeCloseTo(128, 6);
    expect(drawing.cursors[0]!.centre.y).toBeCloseTo(0, 6);
    expect(drawing.cursors[0]!.hasBackground).toBe(true);
  });

  it('runs the value slider through from_ok_hsl(h, s, 1), (h, s, 0.5) and (h, s, 0) (:1052-1069)', () => {
    const drawing = drawControl(OKHSL_CIRCLE, 'value_slider', SLIDER, {
      hsv: HSV,
      okhsl: { h: 0.6, s: 0.5, l: 0.3 },
    });
    expect(drawing.slider!.stops).toEqual([
      okhslToSrgb(0.6, 0.5, 1),
      okhslToSrgb(0.6, 0.5, 0.5),
      okhslToSrgb(0.6, 0.5, 0),
    ]);
  });

  it('draws the line at int(size.y * (1 - l)) in the inverted from_ok_hsl(h, 1, l) (:1076-1078)', () => {
    const drawing = drawControl(OKHSL_CIRCLE, 'value_slider', SLIDER, {
      hsv: HSV,
      okhsl: { h: 0.6, s: 0.5, l: 0.3 },
    });
    expect(drawing.slider!.lineY).toBe(179); // 256 * 0.7 = 179.2
    const full = okhslToSrgb(0.6, 1, 0.3);
    expect(drawing.slider!.lineColor).toEqual({ r: 1 - full.r, g: 1 - full.g, b: 1 - full.b, a: 1 });
  });

  it('shows shape_circle on btn_shape (color_picker_shape.h:227)', () => {
    expect(OKHSL_CIRCLE.icon).toBe('shape_circle');
  });
});
