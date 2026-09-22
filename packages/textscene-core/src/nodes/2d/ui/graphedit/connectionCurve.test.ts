import { describe, expect, it } from 'vitest';
import { connectionControlPoints, tessellateConnectionLine } from './connectionCurve';

describe('connectionControlPoints', () => {
  it('bulges toward the target when from.x < to.x (graph_edit.cpp:1523-1533)', () => {
    // x_diff = 100, cp_offset = 100 * 0.5 = 50 (x_diff >= 0, no sign flip).
    const cp = connectionControlPoints({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.5);
    expect(cp).toEqual({
      p0: { x: 0, y: 0 },
      p1: { x: 50, y: 0 },
      p2: { x: 50, y: 50 },
      p3: { x: 100, y: 50 },
    });
  });

  it('flips the offset sign when from.x > to.x, so it still bulges outward', () => {
    // x_diff = -100, cp_offset = -100 * 0.5 = -50, then negated to 50 (graph_edit.cpp:1527-1529).
    const cp = connectionControlPoints({ x: 100, y: 0 }, { x: 0, y: 50 }, 0.5);
    expect(cp).toEqual({
      p0: { x: 100, y: 0 },
      p1: { x: 150, y: 0 },
      p2: { x: -50, y: 50 },
      p3: { x: 0, y: 50 },
    });
  });

  it('collapses to zero offset at curvature 0 — a straight line', () => {
    const cp = connectionControlPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 0);
    expect(cp.p1).toEqual({ x: 0, y: 0 });
    expect(cp.p2).toEqual({ x: 100, y: 0 });
  });
});

describe('tessellateConnectionLine', () => {
  it('is exactly the two endpoints for curvature 0 (no bake point passes the flatness test)', () => {
    const cp = connectionControlPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 0);
    const points = tessellateConnectionLine(cp, 0);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  it('bakes intermediate points for a curved line, starting and ending at the anchors', () => {
    const cp = connectionControlPoints({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.5);
    const points = tessellateConnectionLine(cp, 0.5);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 100, y: 50 });
    expect(points.length).toBeGreaterThan(2);
  });
});
