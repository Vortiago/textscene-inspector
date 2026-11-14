import { describe, expect, it } from 'vitest';
import { VHS_CIRCLE } from './vhsCircle';
import { controlTree, drawControl } from './shapeDrawing.testkit';

const CIRCLE = { x: 0, y: 0, w: 256, h: 256 };
const SLIDER = { x: 0, y: 0, w: 30, h: 256 };
const OKHSL = { h: 0, s: 0, l: 0 };

describe('VHS_CIRCLE', () => {
  it('adds circle holding circle_overlay over all of it, then value_slider (color_picker_shape.cpp:875-901)', () => {
    expect(controlTree(VHS_CIRCLE)).toEqual([{ circle: ['circle_overlay'] }, 'value_slider']);
    expect(VHS_CIRCLE.controls[0]!.children![0]!.fillsParent).toBe(true);
  });

  it('fills the circle through the circle shader at uniform v (color_picker_shape.cpp:951-955)', () => {
    const drawing = drawControl(VHS_CIRCLE, 'circle', CIRCLE, {
      hsv: { h: 0.5, s: 0.5, v: 0.6 },
      okhsl: OKHSL,
    });
    expect(drawing.fill!.rect).toEqual(CIRCLE);
    expect(drawing.fill!.fragment.name).toBe('vhs-circle');
    expect(drawing.fill!.uniforms).toEqual({ v: 0.6 });
    expect(drawing.cursors).toEqual([]);
  });

  it('puts the cursor h turns round the centre at s of the radius, with its background (:269-284)', () => {
    const drawing = drawControl(VHS_CIRCLE, 'circle_overlay', CIRCLE, {
      hsv: { h: 0.25, s: 0.5, v: 1 },
      okhsl: OKHSL,
    });
    expect(drawing.cursors).toHaveLength(1);
    expect(drawing.cursors[0]!.hasBackground).toBe(true);
    expect(drawing.cursors[0]!.centre.x).toBeCloseTo(128, 6);
    expect(drawing.cursors[0]!.centre.y).toBeCloseTo(128 + 64, 6);
  });

  it('puts the cursor of a grey at the centre', () => {
    const drawing = drawControl(VHS_CIRCLE, 'circle_overlay', CIRCLE, {
      hsv: { h: 0, s: 0, v: 0.5 },
      okhsl: OKHSL,
    });
    expect(drawing.cursors[0]!.centre).toEqual({ x: 128, y: 128 });
  });

  it('runs the value slider from from_hsv(h, s, 1) at the top to opaque black (:962-976)', () => {
    const drawing = drawControl(VHS_CIRCLE, 'value_slider', SLIDER, {
      hsv: { h: 0, s: 0.5, v: 0.6 },
      okhsl: OKHSL,
    });
    expect(drawing.slider!.rect).toEqual(SLIDER);
    expect(drawing.slider!.stops).toEqual([
      { r: 1, g: 0.5, b: 0.5, a: 1 },
      { r: 0, g: 0, b: 0, a: 1 },
    ]);
  });

  it('draws the line at int(size.y * (1 - v)) in the inverted from_hsv(h, 1, v) (:982-986)', () => {
    const drawing = drawControl(VHS_CIRCLE, 'value_slider', SLIDER, {
      hsv: { h: 0, s: 0.5, v: 0.6 },
      okhsl: OKHSL,
    });
    expect(drawing.slider!.lineY).toBe(102); // 256 * 0.4 = 102.4
    const line = drawing.slider!.lineColor;
    expect([line.r, line.g, line.b, line.a].map((c) => Number(c.toFixed(6)))).toEqual([0.4, 1, 1, 1]);
  });

  it('shows shape_circle on btn_shape (color_picker_shape.h:227)', () => {
    expect(VHS_CIRCLE.icon).toBe('shape_circle');
  });
});
