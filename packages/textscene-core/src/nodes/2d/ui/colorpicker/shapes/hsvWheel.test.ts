import { describe, expect, it } from 'vitest';
import { HSV_WHEEL } from './hsvWheel';
import { controlTree, drawControl } from './shapeDrawing.testkit';

const WHEEL = { x: 0, y: 0, w: 256, h: 256 };
const OKHSL = { h: 0, s: 0, l: 0 };
/** `uv_size * SQRT12 * WHEEL_RADIUS` of a 256 px wheel (`color_picker_shape.cpp:791`). */
const RING_RADIUS = 256 * Math.SQRT1_2 * 0.42;

describe('HSV_WHEEL', () => {
  it('adds wheel holding wheel_uv over all of it (color_picker_shape.cpp:688-713)', () => {
    expect(controlTree(HSV_WHEEL)).toEqual([{ wheel: ['wheel_uv'] }]);
    expect(HSV_WHEEL.controls[0]!.children![0]!.fillsParent).toBe(true);
  });

  it('fills the whole wheel through the wheel shader at wheel_radius 0.42 (color_picker_shape.cpp:786-788)', () => {
    const drawing = drawControl(HSV_WHEEL, 'wheel', WHEEL, { hsv: { h: 0, s: 0, v: 0 }, okhsl: OKHSL });
    expect(drawing.fill!.rect).toEqual(WHEEL);
    expect(drawing.fill!.fragment.name).toBe('wheel');
    expect(drawing.fill!.uniforms).toEqual({ wheel_radius: 0.42 });
    expect(drawing.cursors).toEqual([]);
  });

  it('draws the SV square in wheel_uv, at the centre plus and minus the ring radius', () => {
    const drawing = drawControl(HSV_WHEEL, 'wheel_uv', WHEEL, { hsv: { h: 0.3, s: 0, v: 0 }, okhsl: OKHSL });
    const square = drawing.svSquare!;
    expect(square.hue).toBe(0.3);
    expect(square.rect.x).toBeCloseTo(128 - RING_RADIUS, 4);
    expect(square.rect.y).toBeCloseTo(128 - RING_RADIUS, 4);
    expect(square.rect.w).toBeCloseTo(2 * RING_RADIUS, 4);
    expect(square.rect.h).toBeCloseTo(2 * RING_RADIUS, 4);
    expect(drawing.fill).toBeNull();
  });

  it('draws the SV cursor with its background, then the hue cursor at 0.92 of the radius without one', () => {
    const drawing = drawControl(HSV_WHEEL, 'wheel_uv', WHEEL, { hsv: { h: 0.25, s: 1, v: 1 }, okhsl: OKHSL });
    const [sv, hue] = drawing.cursors;
    expect(sv!.hasBackground).toBe(true);
    expect(sv!.centre.x).toBeCloseTo(128 + RING_RADIUS, 4);
    expect(sv!.centre.y).toBeCloseTo(128 - RING_RADIUS, 4);
    expect(hue!.hasBackground).toBe(false);
    expect(hue!.centre.x).toBeCloseTo(128, 4);
    expect(hue!.centre.y).toBeCloseTo(128 + 128 * 0.92, 4);
  });

  it('shows shape_rect_wheel on btn_shape (color_picker_shape.h:196)', () => {
    expect(HSV_WHEEL.icon).toBe('shape_rect_wheel');
  });
});
