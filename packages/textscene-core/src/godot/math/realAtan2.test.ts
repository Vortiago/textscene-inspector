/** `atan2Real` against the `atan2f` of glibc 2.39, the C library of the reference Godot. */
import { describe, it, expect } from 'vitest';
import { atan2Real } from './realAtan2.js';

describe('atan2Real', () => {
  // Each row is y, x and the value `atan2f` prints with `%.17g`.
  it.each([
    [1, 2, 0.46364760398864746],
    [-3, 0.5, -1.4056476354598999],
    [0.6000000238418579, 1, 0.5404195189476013],
    [5, -0.0010000000474974513, 1.5709962844848633],
    [9.999999960041972e-13, 1, 9.999999960041972e-13],
  ])('gives the angle of (%f, %f) as the C library does', (y, x, angle) => {
    expect(atan2Real(y, x)).toBe(angle);
  });

  // The correctly rounded angle is -1.960170030593872, one bit away.
  it('keeps the bit the C library misses, which picks the side a folded CCDIK chain bends to', () => {
    expect(atan2Real(-47.938629150390625, -19.670318603515625)).toBe(-1.9601699113845825);
    expect(Math.fround(Math.atan2(-47.938629150390625, -19.670318603515625))).toBe(-1.960170030593872);
  });

  it('rounds its operands to real_t before it divides', () => {
    expect(atan2Real(0.6, 1)).toBe(atan2Real(Math.fround(0.6), 1));
  });

  it.each([
    [0, 1, 0],
    [-0, 1, -0],
    [0, -1, Math.fround(Math.PI)],
    [-0, -1, -Math.fround(Math.PI)],
    [1, 0, Math.fround(Math.PI / 2)],
    [-1, 0, -Math.fround(Math.PI / 2)],
    [Infinity, Infinity, Math.fround(Math.PI / 4)],
    [-Infinity, -Infinity, -Math.fround((3 * Math.PI) / 4)],
    [1, -Infinity, Math.fround(Math.PI)],
    [-1, Infinity, -0],
  ])('gives the angle of (%f, %f), where an operand is zero or infinite', (y, x, angle) => {
    expect(atan2Real(y, x)).toBe(angle);
  });

  it('gives NaN for an operand that is NaN', () => {
    expect(atan2Real(NaN, 1)).toBeNaN();
    expect(atan2Real(1, NaN)).toBeNaN();
  });
});
