import { describe, expect, it } from 'vitest';
import type { BasisComponents } from '../../math/basis.js';
import { NIL, variant } from '../value/variant.js';
import { BASIS_METHODS } from './basisMethods.js';
import type { MethodContext } from './methodPort.js';

/** The math methods read no random generator and call no Callable. */
const NO_CONTEXT = {} as MethodContext;

const basis = (...components: BasisComponents) => variant('BASIS', components);
const vector3 = (x: number, y: number, z: number) => variant('VECTOR3', { x, y, z });

describe('BASIS_METHODS', () => {
  it('scales each column in scaled_local and each row in scaled', () => {
    const n = basis(1, 1, 1, 1, 1, 1, 1, 1, 1);

    expect(BASIS_METHODS.scaled_local!.run(n, [vector3(2, 3, 4)], NO_CONTEXT)).toEqual(
      basis(2, 3, 4, 2, 3, 4, 2, 3, 4)
    );
    expect(BASIS_METHODS.scaled!.run(n, [vector3(2, 3, 4)], NO_CONTEXT)).toEqual(
      basis(2, 2, 2, 3, 3, 3, 4, 4, 4)
    );
  });

  it('keeps a singular basis as it is in inverse', () => {
    const singular = basis(1, 2, 3, 2, 4, 6, 0, 0, 1);

    expect(BASIS_METHODS.inverse!.run(singular, [], NO_CONTEXT)).toEqual(singular);
  });

  it('gives the identity for looking at a zero target', () => {
    const run = BASIS_METHODS.looking_at!.run;

    expect(run(NIL, [vector3(0, 0, 0), vector3(0, 1, 0), false], NO_CONTEXT)).toEqual(
      basis(1, 0, 0, 0, 1, 0, 0, 0, 1)
    );
  });

  it('looks down -Z at a target ahead', () => {
    const run = BASIS_METHODS.looking_at!.run;

    const turned = run(NIL, [vector3(0, 0, -5), vector3(0, 1, 0), false], NO_CONTEXT).value as number[];

    // Adding zero turns the -0 of the cross products into 0.
    expect(turned.map((component) => component + 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('tells a mirror from a turn in is_conformal only by the axis lengths', () => {
    expect(BASIS_METHODS.is_conformal!.run(basis(-2, 0, 0, 0, 2, 0, 0, 0, 2), [], NO_CONTEXT)).toEqual(
      variant('BOOL', true)
    );
    expect(BASIS_METHODS.is_conformal!.run(basis(1, 0, 0, 0, 2, 0, 0, 0, 2), [], NO_CONTEXT)).toEqual(
      variant('BOOL', false)
    );
  });
});
