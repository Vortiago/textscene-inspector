import { describe, expect, it } from 'vitest';
import { NIL, variant } from '../value/variant.js';
import { PLANE_METHODS } from './planeMethods.js';
import type { MethodContext } from './methodPort.js';

/** The math methods read no random generator and call no Callable. */
const NO_CONTEXT = {} as MethodContext;

const plane = (x: number, y: number, z: number, d: number) => variant('PLANE', { normal: { x, y, z }, d });
const point = (x: number, y: number, z: number) => variant('VECTOR3', { x, y, z });

describe('PLANE_METHODS', () => {
  it('meets three axis planes at their distances', () => {
    const run = PLANE_METHODS.intersect_3!.run;

    expect(run(plane(1, 0, 0, 1), [plane(0, 1, 0, 2), plane(0, 0, 1, 3)], NO_CONTEXT)).toEqual(
      point(1, 2, 3)
    );
  });

  it('gives a null value for planes that share a line', () => {
    expect(
      PLANE_METHODS.intersect_3!.run(plane(1, 0, 0, 1), [plane(2, 0, 0, 1), plane(0, 0, 1, 3)], NO_CONTEXT)
    ).toBe(NIL);
  });

  it('misses a ray that points away from the plane', () => {
    expect(
      PLANE_METHODS.intersects_ray!.run(plane(0, 1, 0, 2), [point(0, 5, 0), point(0, 1, 0)], NO_CONTEXT)
    ).toBe(NIL);
  });

  it('gives the all-zero plane when the normal has no length', () => {
    expect(PLANE_METHODS.normalized!.run(plane(0, 0, 0, 5), [], NO_CONTEXT)).toEqual(plane(0, 0, 0, 0));
  });
});
