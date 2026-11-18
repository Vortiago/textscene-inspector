import { describe, expect, it } from 'vitest';
import { planeDistanceTo } from './plane.js';

describe('planeDistanceTo', () => {
  it('gives a positive distance above the plane and a negative one below it', () => {
    const plane = { normal: { x: 0, y: 1, z: 0 }, d: 2 };

    expect(planeDistanceTo(plane, { x: 7, y: 5, z: -1 })).toBe(3);
    expect(planeDistanceTo(plane, { x: 7, y: -1, z: -1 })).toBe(-3);
  });

  it('gives NaN for a NaN point', () => {
    expect(planeDistanceTo({ normal: { x: 1, y: 0, z: 0 }, d: 0 }, { x: NaN, y: 0, z: 0 })).toBeNaN();
  });
});
