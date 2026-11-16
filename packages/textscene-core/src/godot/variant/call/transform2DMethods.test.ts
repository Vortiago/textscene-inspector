import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { TRANSFORM2D_METHODS } from './transform2DMethods.js';

const transform = (a: number, b: number, c: number, d: number, tx: number, ty: number) =>
  variant('TRANSFORM2D', { a, b, c, d, tx, ty });
const vector2 = (x: number, y: number) => variant('VECTOR2', { x, y });

describe('TRANSFORM2D_METHODS', () => {
  it('scales each row and the origin in scaled, and each column in scaled_local', () => {
    const t = transform(1, 1, 1, 1, 1, 1);

    expect(TRANSFORM2D_METHODS.scaled!.run(t, [vector2(2, 3)])).toEqual(transform(2, 3, 2, 3, 2, 3));
    expect(TRANSFORM2D_METHODS.scaled_local!.run(t, [vector2(2, 3)])).toEqual(transform(2, 2, 3, 3, 1, 1));
  });

  it('transposes the basis in inverse, and inverts the scale too in affine_inverse', () => {
    const t = transform(2, 0, 0, 4, 2, 4);

    expect(TRANSFORM2D_METHODS.inverse!.run(t, [])).toEqual(transform(2, 0, 0, 4, -4, -16));
    expect(TRANSFORM2D_METHODS.affine_inverse!.run(t, [])).toEqual(transform(0.5, -0, -0, 0.25, -1, -1));
  });

  it('keeps a singular transform as it is in affine_inverse', () => {
    const singular = transform(1, 2, 2, 4, 5, 6);

    expect(TRANSFORM2D_METHODS.affine_inverse!.run(singular, [])).toEqual(singular);
  });

  it('moves the origin along the axes in translated_local', () => {
    const t = transform(0, 1, -1, 0, 3, 4);

    expect(TRANSFORM2D_METHODS.translated_local!.run(t, [vector2(2, 0)])).toEqual(
      transform(0, 1, -1, 0, 3, 6)
    );
  });
});
