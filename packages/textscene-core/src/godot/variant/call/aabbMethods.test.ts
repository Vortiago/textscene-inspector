import { describe, expect, it } from 'vitest';
import { NIL, variant } from '../value/variant.js';
import { AABB_METHODS } from './aabbMethods.js';

const vector3 = (x: number, y: number, z: number) => ({ x, y, z });
const box = variant('AABB', { position: vector3(-1, -2, -3), size: vector3(2, 4, 6) });
const point = (x: number, y: number, z: number) => variant('VECTOR3', vector3(x, y, z));

describe('AABB_METHODS', () => {
  it('puts the hit of a ray from outside exactly on the box face', () => {
    expect(AABB_METHODS.intersects_ray!.run(box, [point(-5, 0, 0), point(1, 0, 0)])).toEqual(point(-1, 0, 0));
  });

  it('gives the origin of a ray that starts inside', () => {
    expect(AABB_METHODS.intersects_ray!.run(box, [point(0, 0, 0), point(1, 0, 0)])).toEqual(point(0, 0, 0));
  });

  it('gives a null value for a segment that stops short of the box', () => {
    expect(AABB_METHODS.intersects_segment!.run(box, [point(-5, 0, 0), point(-3, 0, 0)])).toBe(NIL);
  });

  it('gives the zero vector for an endpoint index past 7', () => {
    expect(AABB_METHODS.get_endpoint!.run(box, [8])).toEqual(point(0, 0, 0));
  });

  it('keeps the earlier axis on a tie for the shortest axis', () => {
    const flat = variant('AABB', { position: vector3(0, 0, 0), size: vector3(1, 3, 1) });

    expect(AABB_METHODS.get_shortest_axis_index!.run(flat, [])).toEqual(variant('INT', 0n));
  });
});
