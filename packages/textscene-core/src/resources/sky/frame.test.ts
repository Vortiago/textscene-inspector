/** The frame a sky filter builds around a texel's direction. */

import { describe, expect, it } from 'vitest';
import type { OctDirection } from '../../godot/octmap';
import { frameAround } from './frame';

function frame(up: OctDirection, normal: OctDirection): { x: number[]; y: number[] } {
  const x = new Float64Array(3);
  const y = new Float64Array(3);
  frameAround(up, normal, x, y);
  return { x: [...x], y: [...y] };
}

const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

describe('frameAround', () => {
  it('builds x as cross(up, normal) and y as cross(normal, x)', () => {
    const { x, y } = frame([0, 1, 0], [0, 0, 1]);
    expect(x).toEqual([1, 0, 0]);
    expect(y).toEqual([0, 1, 0]);
  });

  it('gives unit axes at right angles to each other and to an oblique normal', () => {
    const length = Math.hypot(1, 2, 3);
    const normal: OctDirection = [1 / length, 2 / length, 3 / length];
    const { x, y } = frame([0, 1, 0], normal);
    expect(dot(x, x)).toBeCloseTo(1, 12);
    expect(dot(y, y)).toBeCloseTo(1, 12);
    expect(dot(x, y)).toBeCloseTo(0, 12);
    expect(dot(x, normal)).toBeCloseTo(0, 12);
    expect(dot(y, normal)).toBeCloseTo(0, 12);
  });

  it('has no x for a normal along up, which is why each filter picks another up there', () => {
    const { x } = frame([0, 1, 0], [0, 1, 0]);
    expect(x.every(Number.isNaN)).toBe(true);
  });
});
