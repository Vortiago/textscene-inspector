import { describe, expect, it } from 'vitest';
import type { BasisComponents } from '../../math/basis.js';
import { identityTransform3D, transform3DOf } from '../../math/transform3d.js';
import { variant } from '../value/variant.js';
import { TRANSFORM3D_METHODS } from './transform3DMethods.js';
import type { MethodContext } from './methodPort.js';

/** The math methods read no random generator and call no Callable. */
const NO_CONTEXT = {} as MethodContext;

const transform = (n: BasisComponents, x: number, y: number, z: number) =>
  variant('TRANSFORM3D', transform3DOf(n, { x, y, z }));
const vector3 = (x: number, y: number, z: number) => variant('VECTOR3', { x, y, z });

describe('TRANSFORM3D_METHODS', () => {
  it('scales each row and the origin in scaled, and each column in scaled_local', () => {
    const t = transform([1, 1, 1, 1, 1, 1, 1, 1, 1], 1, 1, 1);

    expect(TRANSFORM3D_METHODS.scaled!.run(t, [vector3(2, 3, 4)], NO_CONTEXT)).toEqual(
      transform([2, 2, 2, 3, 3, 3, 4, 4, 4], 2, 3, 4)
    );
    expect(TRANSFORM3D_METHODS.scaled_local!.run(t, [vector3(2, 3, 4)], NO_CONTEXT)).toEqual(
      transform([2, 3, 4, 2, 3, 4, 2, 3, 4], 1, 1, 1)
    );
  });

  it('takes the negated origin through the transposed basis in inverse', () => {
    const t = transform([0, -1, 0, 1, 0, 0, 0, 0, 1], 2, 3, 4);

    expect(TRANSFORM3D_METHODS.inverse!.run(t, [], NO_CONTEXT)).toEqual(
      transform([0, 1, 0, -1, 0, 0, 0, 0, 1], -3, 2, -4)
    );
  });

  it('gives Transform3D() for looking at its own origin', () => {
    const t = transform([2, 0, 0, 0, 2, 0, 0, 0, 2], 1, 2, 3);
    const run = TRANSFORM3D_METHODS.looking_at!.run;

    expect(run(t, [vector3(1, 2, 3), vector3(0, 1, 0), false], NO_CONTEXT)).toEqual(
      variant('TRANSFORM3D', identityTransform3D())
    );
  });

  it('moves the origin along the axes in translated_local', () => {
    const t = transform([0, -1, 0, 1, 0, 0, 0, 0, 1], 2, 3, 4);

    expect(TRANSFORM3D_METHODS.translated_local!.run(t, [vector3(1, 0, 0)], NO_CONTEXT)).toEqual(
      transform([0, -1, 0, 1, 0, 0, 0, 0, 1], 2, 4, 4)
    );
  });
});
