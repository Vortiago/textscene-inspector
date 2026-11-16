import { describe, expect, it } from 'vitest';
import { NIL, variant, type ProjectionValue } from '../value/variant.js';
import { PROJECTION_METHODS } from './projectionMethods.js';
import type { MethodContext } from './methodPort.js';

/** The math methods read no random generator and call no Callable. */
const NO_CONTEXT = {} as MethodContext;

const projection = (...m: number[]) =>
  variant(
    'PROJECTION',
    [0, 4, 8, 12].map((at) => ({
      x: m[at]!,
      y: m[at + 1]!,
      z: m[at + 2]!,
      w: m[at + 3]!,
    })) as unknown as ProjectionValue
  );
const IDENTITY = projection(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

describe('PROJECTION_METHODS', () => {
  it('inverts a scale and a translation', () => {
    const scaled = projection(2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 8, 0, 2, 4, 8, 1);

    expect(PROJECTION_METHODS.inverse!.run(scaled, [], NO_CONTEXT)).toEqual(
      projection(0.5, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 0.125, 0, -1, -1, -1, 1)
    );
  });

  it('keeps a singular projection as it is in inverse', () => {
    const singular = projection(1, 2, 3, 4, 2, 4, 6, 8, 0, 1, 0, 1, 1, 0, 1, 0);

    expect(PROJECTION_METHODS.inverse!.run(singular, [], NO_CONTEXT)).toEqual(singular);
  });

  it('gives the identity for a frustum whose right edge is not right of its left one', () => {
    expect(PROJECTION_METHODS.create_frustum!.run(NIL, [0.2, -0.3, -0.1, 0.25, 0.1, 50], NO_CONTEXT)).toEqual(
      IDENTITY
    );
  });

  it('gives the all-zero plane for a plane index past the six', () => {
    expect(PROJECTION_METHODS.get_projection_plane!.run(IDENTITY, [6], NO_CONTEXT)).toEqual(
      variant('PLANE', { normal: { x: 0, y: 0, z: 0 }, d: 0 })
    );
  });
});
