import { describe, expect, it } from 'vitest';
import { acosReal } from './realAcos.js';

const f = Math.fround;

describe('acosReal', () => {
  // Printed by glibc 2.39 acosf, which also agrees with the port on 34,929,614 sampled floats.
  it.each([
    [0.3, 1.26610363],
    [-0.3, 1.875489],
    [0.7, 0.795398831],
    [-0.7, 2.34619379],
    [0.99, 0.14153941],
    [-0.99, 3.00005317],
    [0.97, 0.2455654],
  ])('gives the acosf of glibc for %f', (x, angle) => {
    expect(acosReal(f(x))).toBe(f(angle));
  });

  it('gives exactly 0 at 1 and the float of pi at -1', () => {
    expect(acosReal(1)).toBe(0);
    expect(acosReal(-1)).toBe(f(Math.PI));
  });

  it('gives NaN past the ends and for NaN', () => {
    expect(acosReal(f(1.5))).toBeNaN();
    expect(acosReal(NaN)).toBeNaN();
  });
});
