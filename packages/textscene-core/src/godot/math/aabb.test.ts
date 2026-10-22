import { describe, expect, it } from 'vitest';
import {
  aabbCenter,
  aabbEdges,
  aabbEndpoint,
  aabbLongestAxisSize,
  aabbOfPoints,
  centredAabb,
  EMPTY_AABB,
  hasSurface,
  isEmptyAabb,
  mergeAabb,
  transformAabb,
  type Aabb,
} from './aabb';

function box(px: number, py: number, pz: number, sx: number, sy: number, sz: number): Aabb {
  return { position: { x: px, y: py, z: pz }, size: { x: sx, y: sy, z: sz } };
}

describe('hasSurface', () => {
  it('holds when one side is positive', () => {
    expect(hasSurface({ x: 0, y: 2, z: 0 })).toBe(true);
  });

  it('fails for a point', () => {
    expect(hasSurface({ x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('fails for negative sides', () => {
    expect(hasSurface({ x: -1, y: -1, z: -1 })).toBe(false);
  });
});

describe('mergeAabb', () => {
  it('holds both boxes', () => {
    expect(mergeAabb(box(0, 0, 0, 1, 1, 1), box(2, -1, 0, 1, 1, 3))).toEqual(box(0, -1, 0, 3, 2, 3));
  });

  it('keeps a box that holds the other', () => {
    expect(mergeAabb(box(-2, -2, -2, 4, 4, 4), box(0, 0, 0, 1, 1, 1))).toEqual(box(-2, -2, -2, 4, 4, 4));
  });

  it('reaches the origin from AABB(), which Godot merges as a point there', () => {
    expect(mergeAabb(EMPTY_AABB, box(2, 2, 2, 1, 1, 1))).toEqual(box(0, 0, 0, 3, 3, 3));
  });
});

describe('isEmptyAabb', () => {
  it('holds for AABB()', () => {
    expect(isEmptyAabb(box(0, 0, 0, 0, 0, 0))).toBe(true);
  });

  it('fails for a point away from the origin', () => {
    expect(isEmptyAabb(box(1, 0, 0, 0, 0, 0))).toBe(false);
  });

  it('fails for a box with a size', () => {
    expect(isEmptyAabb(box(0, 0, 0, 0, 0, 1))).toBe(false);
  });
});

describe('transformAabb', () => {
  it('moves a box by the origin', () => {
    const transform = [1, 0, 0, 5, 0, 1, 0, -1, 0, 0, 1, 2];
    expect(transformAabb(transform, box(-1, -1, -1, 2, 2, 2))).toEqual(box(4, -2, 1, 2, 2, 2));
  });

  it('bounds a rotated box: a quarter turn about Y swaps x and z', () => {
    const transform = [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0];
    expect(transformAabb(transform, box(0, 0, 0, 4, 1, 2))).toEqual(box(0, 0, -4, 2, 1, 4));
  });

  it('collapses a box under a zero basis to a point at the origin', () => {
    const transform = [0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3];
    expect(transformAabb(transform, box(-1, -1, -1, 2, 2, 2))).toEqual(box(3, 3, 3, 0, 0, 0));
  });
});

describe('aabbOfPoints', () => {
  it('spans the least and the greatest point on each axis', () => {
    expect(aabbOfPoints([1, -2, 3, -1, 4, 0, 0, 0, 5])).toEqual({
      position: { x: -1, y: -2, z: 0 },
      size: { x: 2, y: 6, z: 5 },
    });
  });

  it('is a box of no size round one point', () => {
    expect(aabbOfPoints([1, 2, 3])).toEqual({ position: { x: 1, y: 2, z: 3 }, size: { x: 0, y: 0, z: 0 } });
  });

  it('is AABB() for no points (edge case)', () => {
    expect(aabbOfPoints([])).toBe(EMPTY_AABB);
  });
});

describe('aabbEdges', () => {
  it('lists the 12 edges of AABB::get_edge in order, each from its start to its end', () => {
    expect(aabbEdges(box(-1, 0, -1, 2, 3, 2))).toEqual([
      ...[1, 0, -1, -1, 0, -1],
      ...[1, 0, 1, 1, 0, -1],
      ...[-1, 0, 1, 1, 0, 1],
      ...[-1, 0, -1, -1, 0, 1],
      ...[-1, 3, -1, 1, 3, -1],
      ...[1, 3, -1, 1, 3, 1],
      ...[1, 3, 1, -1, 3, 1],
      ...[-1, 3, 1, -1, 3, -1],
      ...[-1, 0, 1, -1, 3, 1],
      ...[-1, 0, -1, -1, 3, -1],
      ...[1, 0, -1, 1, 3, -1],
      ...[1, 0, 1, 1, 3, 1],
    ]);
  });

  it('draws the default GPUParticles3D box from -4 to 4', () => {
    const edges = aabbEdges(box(-4, -4, -4, 8, 8, 8));
    expect(edges.slice(0, 6)).toEqual([4, -4, -4, -4, -4, -4]);
    expect(Math.max(...edges)).toBe(4);
    expect(Math.min(...edges)).toBe(-4);
  });

  it('collapses every edge onto the origin for AABB() (edge case)', () => {
    expect(aabbEdges(EMPTY_AABB)).toEqual(new Array(72).fill(0));
  });

  it('keeps a negative size as the engine does: the far corner lies below the near one (edge case)', () => {
    expect(aabbEdges(box(0, 0, 0, -2, 1, 1)).slice(0, 6)).toEqual([-2, 0, 0, 0, 0, 0]);
  });
});

describe('aabbCenter', () => {
  it('is the position plus half the size (AABB::get_center)', () => {
    expect(aabbCenter(box(-2, 0, 4, 4, 2, 2))).toEqual({ x: 0, y: 1, z: 5 });
  });

  it('is the origin for AABB() (edge case)', () => {
    expect(aabbCenter(EMPTY_AABB)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('aabbEndpoint', () => {
  const sample = box(1, 2, 3, 10, 20, 30);

  it.each([
    [0, { x: 1, y: 2, z: 3 }],
    [1, { x: 1, y: 2, z: 33 }],
    [2, { x: 1, y: 22, z: 3 }],
    [3, { x: 1, y: 22, z: 33 }],
    [4, { x: 11, y: 2, z: 3 }],
    [5, { x: 11, y: 2, z: 33 }],
    [6, { x: 11, y: 22, z: 3 }],
    [7, { x: 11, y: 22, z: 33 }],
  ])('names corner %i in the order of AABB::get_endpoint', (index, corner) => {
    expect(aabbEndpoint(sample, index)).toEqual(corner);
  });

  it('puts every corner of AABB() on the origin (edge case)', () => {
    expect(aabbEndpoint(EMPTY_AABB, 7)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('refuses an index outside 0 to 7, as the engine does (error case)', () => {
    expect(() => aabbEndpoint(sample, 8)).toThrow('expected a corner index from 0 to 7, got 8');
  });
});

describe('aabbLongestAxisSize', () => {
  it('is the largest of the three sizes', () => {
    expect(aabbLongestAxisSize(box(0, 0, 0, 40, 10, 20))).toBe(40);
  });

  it('takes the Z size when it is the largest', () => {
    expect(aabbLongestAxisSize(box(0, 0, 0, 1, 2, 3))).toBe(3);
  });

  it('is the first size when none is positive (edge case)', () => {
    expect(aabbLongestAxisSize(box(0, 0, 0, -1, -2, -3))).toBe(-1);
  });
});

describe('centredAabb', () => {
  it('is the box of that size with its centre on the origin', () => {
    expect(centredAabb({ x: 20, y: 10, z: 4 })).toEqual(box(-10, -5, -2, 20, 10, 4));
  });

  it('puts a size of 0 at the origin, as the negative zero the division leaves (edge case)', () => {
    expect(centredAabb({ x: 0, y: 0, z: 0 })).toEqual(box(-0, -0, -0, 0, 0, 0));
  });

  it('keeps a negative size, which then puts the position above the origin (edge case)', () => {
    expect(centredAabb({ x: -2, y: 1, z: 1 })).toEqual(box(1, -0.5, -0.5, -2, 1, 1));
  });
});
