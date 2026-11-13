import { describe, expect, it } from 'vitest';
import { VHS_CIRCLE } from './vhsCircle';

const SPLIT = { area: { x: 1, y: 0, w: 256, h: 256 }, slider: { x: 261, y: 0, w: 30, h: 256 } };
const OKHSL = { h: 0, s: 0, l: 0 };

describe('VHS_CIRCLE', () => {
  it('fills the circle through the circle shader at uniform v (color_picker_shape.cpp:951-955)', () => {
    const drawing = VHS_CIRCLE.draw(SPLIT, { hsv: { h: 0.5, s: 0.5, v: 0.6 }, okhsl: OKHSL });
    expect(drawing.fill!.rect).toEqual(SPLIT.area);
    expect(drawing.fill!.fragment.name).toBe('vhs-circle');
    expect(drawing.fill!.uniforms).toEqual({ v: 0.6 });
    expect(drawing.svSquare).toBeNull();
  });

  it('puts the cursor h turns round the centre at s of the radius, with its background (:269-284)', () => {
    const drawing = VHS_CIRCLE.draw(SPLIT, { hsv: { h: 0.25, s: 0.5, v: 1 }, okhsl: OKHSL });
    expect(drawing.cursors).toHaveLength(1);
    expect(drawing.cursors[0]!.hasBackground).toBe(true);
    expect(drawing.cursors[0]!.centre.x).toBeCloseTo(1 + 128, 6);
    expect(drawing.cursors[0]!.centre.y).toBeCloseTo(128 + 64, 6);
  });

  it('puts the cursor of a grey at the centre', () => {
    const drawing = VHS_CIRCLE.draw(SPLIT, { hsv: { h: 0, s: 0, v: 0.5 }, okhsl: OKHSL });
    expect(drawing.cursors[0]!.centre).toEqual({ x: 129, y: 128 });
  });

  it('runs the value slider from from_hsv(h, s, 1) at the top to opaque black (:962-976)', () => {
    const drawing = VHS_CIRCLE.draw(SPLIT, { hsv: { h: 0, s: 0.5, v: 0.6 }, okhsl: OKHSL });
    expect(drawing.slider!.rect).toEqual(SPLIT.slider);
    expect(drawing.slider!.stops).toEqual([
      { r: 1, g: 0.5, b: 0.5, a: 1 },
      { r: 0, g: 0, b: 0, a: 1 },
    ]);
  });

  it('draws the line at int(size.y * (1 - v)) in the inverted from_hsv(h, 1, v) (:982-986)', () => {
    const drawing = VHS_CIRCLE.draw(SPLIT, { hsv: { h: 0, s: 0.5, v: 0.6 }, okhsl: OKHSL });
    expect(drawing.slider!.lineY).toBe(102); // 256 * 0.4 = 102.4
    const line = drawing.slider!.lineColor;
    expect([line.r, line.g, line.b, line.a].map((c) => Number(c.toFixed(6)))).toEqual([0.4, 1, 1, 1]);
  });

  it('shows shape_circle on btn_shape (color_picker_shape.h:227)', () => {
    expect(VHS_CIRCLE.icon).toBe('shape_circle');
  });
});
