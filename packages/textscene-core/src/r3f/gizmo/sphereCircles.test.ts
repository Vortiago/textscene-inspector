import { describe, expect, it } from 'vitest';
import { sphereCircleLines } from './sphereCircles';

const SEGMENT_FLOATS = 6;
const SEGMENTS = 384;

/** The segment `index` as `[from, to]` points. */
function segment(lines: number[], index: number) {
  const start = index * SEGMENT_FLOATS;
  return [lines.slice(start, start + 3), lines.slice(start + 3, start + 6)];
}

describe('sphereCircleLines', () => {
  it.each([1, 1.5, 2.5])('returns 384 segments for radius %s', (radius) => {
    expect(sphereCircleLines(radius)).toHaveLength(SEGMENTS * SEGMENT_FLOATS);
  });

  it('starts at (radius, 0, 0) and steps PI / 64 along the XZ circle', () => {
    const [from, to] = segment(sphereCircleLines(2), 0);
    // x = 2 cos(PI / 64), y = 2 sin(PI / 64). The engine's float subtraction leaves y a few 1e-7 off.
    expect(from).toEqual([2, 0, 0]);
    expect(to[0]).toBeCloseTo(1.9975909124, 5);
    expect(to[1]).toBe(0);
    expect(to[2]).toBeCloseTo(0.0981353487, 5);
  });

  it('mirrors the first XZ segment across the diagonal, as the second PUSH_QUARTER call does', () => {
    const [from, to] = segment(sphereCircleLines(2), 4);
    expect(from[0]).toBeCloseTo(0, 6);
    expect(from[2]).toBeCloseTo(2, 6);
    expect(to[0]).toBeCloseTo(0.0981353487, 5);
    expect(to[2]).toBeCloseTo(1.9975909124, 5);
  });

  it('ends each octant on the diagonal, where x equals y', () => {
    const lines = sphereCircleLines(1);
    // Each iteration writes 24 segments: six PUSH_QUARTER calls of four.
    const [, to] = segment(lines, 15 * 24);
    expect(to[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(to[2]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('draws the XY circle in the z = 0 plane and the YZ circle in the x = 0 plane', () => {
    const lines = sphereCircleLines(1);
    const xy = segment(lines, 8);
    const yz = segment(lines, 16);
    expect([xy[0][2], xy[1][2]]).toEqual([0, 0]);
    expect([yz[0][0], yz[1][0]]).toEqual([0, 0]);
  });

  it('keeps every point on the sphere', () => {
    const lines = sphereCircleLines(1.5);
    for (let i = 0; i < lines.length; i += 3) {
      expect(Math.hypot(lines[i]!, lines[i + 1]!, lines[i + 2]!)).toBeCloseTo(1.5, 5);
    }
  });

  it('collapses to the origin for radius 0 without NaN (edge case)', () => {
    expect(sphereCircleLines(0).every((value) => value === 0)).toBe(true);
  });

  it('starts at (-radius, 0, 0) for a negative radius, as Godot computes it (edge case)', () => {
    const [from] = segment(sphereCircleLines(-1), 0);
    expect(from).toEqual([-1, 0, 0]);
  });
});
