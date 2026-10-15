import { describe, expect, it } from 'vitest';
import { EMPTY_AABB, hasSurface, isEmptyAabb, mergeAabb, transformAabb, type Aabb } from './aabb';

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
