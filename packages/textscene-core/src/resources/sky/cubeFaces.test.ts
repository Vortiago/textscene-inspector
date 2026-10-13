import { describe, expect, it } from 'vitest';
import { cubeFace, cubeTexel, texelDirection } from './cubeFaces';

const SIZE = 4;

describe('texelDirection', () => {
  it.each([
    [0, [1, 0, 0]],
    [1, [-1, 0, 0]],
    [2, [0, 1, 0]],
    [3, [0, -1, 0]],
    [4, [0, 0, 1]],
    [5, [0, 0, -1]],
  ] as const)('points face %i along its axis, on average over its texels', (face, axis) => {
    const sum = [0, 0, 0];
    for (let texel = 0; texel < SIZE * SIZE; texel += 1) {
      texelDirection(face, texel, SIZE).forEach((component, i) => (sum[i] = sum[i]! + component));
    }
    sum.forEach((component, i) => expect(Math.sign(Math.round(component)) + 0).toBe(axis[i]));
  });

  it('puts +Y in the first row of the +X face', () => {
    expect(texelDirection(0, 1, SIZE)[1]).toBeGreaterThan(0);
  });
});

describe('cubeFace', () => {
  it('picks the face of the largest component', () => {
    expect(cubeFace([0.2, -0.9, 0.3])).toBe(3);
  });

  it('picks X on a tie with Z (edge case)', () => {
    expect(cubeFace([-0.5, 0, 0.5])).toBe(1);
  });
});

describe('cubeTexel', () => {
  it('finds every texel from the direction through its centre', () => {
    for (let face = 0; face < 6; face += 1) {
      for (let texel = 0; texel < SIZE * SIZE; texel += 1) {
        const direction = texelDirection(face, texel, SIZE);
        expect([cubeFace(direction), cubeTexel(direction, SIZE)]).toEqual([face, texel]);
      }
    }
  });

  it('keeps a direction on the far edge of a face inside the face (edge case)', () => {
    expect(cubeTexel([1, -1, -1], SIZE)).toBe(SIZE * SIZE - 1);
  });
});
