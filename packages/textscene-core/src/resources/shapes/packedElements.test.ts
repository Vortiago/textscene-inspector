/** The flat element readers: one element of a flat packed array, and the element count. */
import { describe, expect, it } from 'vitest';
import { colorAt, colorCount, vector2At, vector2Count, vector3At, vector3Count } from './packedElements';

describe('the flat element readers', () => {
  it('read the element at an index of a flat PackedVector2Array', () => {
    const points = new Float32Array([1, 2, -3, 0.5]);
    expect([vector2Count(points), vector2At(points, 1)]).toEqual([2, { x: -3, y: 0.5 }]);
  });

  it('read the element at an index of a flat PackedVector3Array', () => {
    const points = new Float32Array([1, 2, 3, -4, 0.5, 6]);
    expect([vector3Count(points), vector3At(points, 1)]).toEqual([2, { x: -4, y: 0.5, z: 6 }]);
  });

  it('read the element at an index of a flat PackedColorArray', () => {
    const colors = new Float32Array([1, 0, 0, 1, 0, 0.5, 1, 0.25]);
    expect([colorCount(colors), colorAt(colors, 1)]).toEqual([2, { r: 0, g: 0.5, b: 1, a: 0.25 }]);
  });
});
