import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { QUATERNION_METHODS } from './quaternionMethods.js';
import type { MethodContext } from './methodPort.js';

/** The math methods read no random generator and call no Callable. */
const NO_CONTEXT = {} as MethodContext;

const quaternion = (x: number, y: number, z: number, w: number) => variant('QUATERNION', { x, y, z, w });

describe('QUATERNION_METHODS', () => {
  it('gives the identity for the inverse of a quaternion that is not normalised', () => {
    expect(QUATERNION_METHODS.inverse!.run(quaternion(1, 2, 3, 4), [], NO_CONTEXT)).toEqual(
      quaternion(0, 0, 0, 1)
    );
  });

  it('gives the conjugate for the inverse of a unit quaternion', () => {
    expect(QUATERNION_METHODS.inverse!.run(quaternion(0.5, -0.5, 0.5, 0.5), [], NO_CONTEXT)).toEqual(
      quaternion(-0.5, 0.5, -0.5, 0.5)
    );
  });

  it('gives the zero vector for the Euler angles of a quaternion that is not normalised', () => {
    expect(QUATERNION_METHODS.get_euler!.run(quaternion(1, 2, 3, 4), [2], NO_CONTEXT)).toEqual(
      variant('VECTOR3', { x: 0, y: 0, z: 0 })
    );
  });

  it('keeps the start when slerpni meets a quaternion on the same line', () => {
    const start = quaternion(0, 0, 0, 1);

    expect(QUATERNION_METHODS.slerpni!.run(start, [quaternion(0, 0, 0, -1), 0.5], NO_CONTEXT)).toEqual(start);
  });

  it('turns the vector part of the identity into the identity through exp', () => {
    expect(QUATERNION_METHODS.exp!.run(quaternion(0, 0, 0, 1), [], NO_CONTEXT)).toEqual(
      quaternion(0, 0, 0, 1)
    );
  });
});
