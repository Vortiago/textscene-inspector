import { describe, it, expect } from 'vitest';
import { edgeCastsShadow, lightRectTest, type LightRect, type Quad2 } from './shadowCasterEdges';
import { axisAlignedBounds } from './testing/worldEdges';
import { OccluderPolygon2DCullMode } from '../../godot/scene/lightOccluder2d';

describe('edgeCastsShadow', () => {
  it('takes every non-degenerate edge when culling is disabled', () => {
    expect(edgeCastsShadow(100, -50, 100, 50, OccluderPolygon2DCullMode.DISABLED)).toBe(true);
    expect(edgeCastsShadow(100, 50, 100, -50, OccluderPolygon2DCullMode.DISABLED)).toBe(true);
  });

  it('splits the two winding modes across the same edge', () => {
    const cw = edgeCastsShadow(100, -50, 100, 50, OccluderPolygon2DCullMode.CLOCKWISE);
    const ccw = edgeCastsShadow(100, -50, 100, 50, OccluderPolygon2DCullMode.COUNTER_CLOCKWISE);
    expect(cw).not.toBe(ccw);
  });

  it('flips which mode takes an edge when the edge is reversed', () => {
    const forward = edgeCastsShadow(100, -50, 100, 50, OccluderPolygon2DCullMode.CLOCKWISE);
    const reversed = edgeCastsShadow(100, 50, 100, -50, OccluderPolygon2DCullMode.CLOCKWISE);
    expect(forward).not.toBe(reversed);
  });

  it('rejects an edge collinear with the light, in front of it or straddling it', () => {
    for (const mode of [
      OccluderPolygon2DCullMode.DISABLED,
      OccluderPolygon2DCullMode.CLOCKWISE,
      OccluderPolygon2DCullMode.COUNTER_CLOCKWISE,
    ] as const) {
      // Pointing away from the light along +X.
      expect(edgeCastsShadow(100, 0, 200, 0, mode)).toBe(false);
      // Straddling the light.
      expect(edgeCastsShadow(-100, 0, 100, 0, mode)).toBe(false);
    }
  });

  it('rejects a zero-length edge', () => {
    expect(edgeCastsShadow(100, 50, 100, 50, OccluderPolygon2DCullMode.DISABLED)).toBe(false);
  });

  it('rejects an edge carrying a non-finite coordinate rather than emitting NaN downstream', () => {
    expect(edgeCastsShadow(NaN, 50, 100, -50, OccluderPolygon2DCullMode.DISABLED)).toBe(false);
    expect(edgeCastsShadow(100, 50, Infinity, -50, OccluderPolygon2DCullMode.DISABLED)).toBe(false);
  });
});

describe('lightRectTest', () => {
  const rect: LightRect = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  const inRect = lightRectTest(rect);

  /** The local bounds (0, 0)-(size, size) turned 45° about `origin`. */
  function turnedSquare(origin: { x: number; y: number }, size: number): Quad2 {
    const step = size / Math.SQRT2;
    return [
      origin,
      { x: origin.x + step, y: origin.y + step },
      { x: origin.x, y: origin.y + 2 * step },
      { x: origin.x - step, y: origin.y + step },
    ];
  }

  it('keeps an occluder whose bounds overlap the rect', () => {
    expect(inRect(axisAlignedBounds([5, 5, 40, 40]))).toBe(true);
  });

  it('keeps an occluder whose bounds merely touch the rect edge', () => {
    expect(inRect(axisAlignedBounds([10, 0, 40, 0]))).toBe(true);
  });

  it('drops an occluder whose bounds lie outside the rect', () => {
    expect(inRect(axisAlignedBounds([20, 20, 40, 40]))).toBe(false);
  });

  it("tests the turned bounds, as Godot's `intersects_transformed` does, not their world box", () => {
    // `renderer_canvas_render_rd.cpp:1056`: this diamond's world box overlaps the rect's corner
    // (10, 10), but the diamond itself stays clear of it.
    expect(inRect(turnedSquare({ x: 18, y: 2.5 }, 12))).toBe(false);
  });

  it('keeps an occluder whose turned bounds overlap the rect', () => {
    expect(inRect(turnedSquare({ x: 12, y: 0 }, 12))).toBe(true);
  });

  it('drops an occluder with no points, whose bounds are not finite', () => {
    expect(inRect(axisAlignedBounds([]))).toBe(false);
  });
});
