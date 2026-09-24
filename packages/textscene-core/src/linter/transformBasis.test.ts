/**
 * A non-finite basis component is a legal value Godot writes and reloads
 * (`variant_parser.cpp:149-157`), and both predicates answer it rather than
 * treat it as an unparseable literal.
 */

import { describe, it, expect } from 'vitest';
import { hasNonUnitScale3D, isOrthonormalTransform, transform3DBasis } from './transformBasis.js';

const IDENTITY = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';

/** One non-finite component in the first basis row, the rest identity. */
const withFirstComponent = (text: string) =>
  `Transform3D(${text}, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)`;

describe('transform3DBasis', () => {
  it('reads the nine row-major basis components, dropping the origin', () => {
    expect(transform3DBasis('Transform3D(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)')).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('answers null for a literal that does not parse', () => {
    expect(transform3DBasis('Transform3D(1, 0, 0)')).toBeNull();
    expect(transform3DBasis('nonsense')).toBeNull();
  });

  it('admits every non-finite spelling Godot writes', () => {
    expect(transform3DBasis(withFirstComponent('inf'))![0]).toBe(Infinity);
    expect(transform3DBasis(withFirstComponent('-inf'))![0]).toBe(-Infinity);
    expect(transform3DBasis(withFirstComponent('inf_neg'))![0]).toBe(-Infinity);
    expect(transform3DBasis(withFirstComponent('nan'))![0]).toBeNaN();
  });
});

describe('hasNonUnitScale3D', () => {
  it('stays quiet on the identity and on a pure translation', () => {
    expect(hasNonUnitScale3D(IDENTITY)).toBe(false);
    expect(hasNonUnitScale3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, -2, 9)')).toBe(false);
    expect(hasNonUnitScale3D(undefined)).toBe(false);
  });

  it('reports a scaled and a degenerate basis', () => {
    expect(hasNonUnitScale3D('Transform3D(2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBe(true);
    // SIGN(0) is 0, so get_scale is (0, 0, 0) (basis.cpp:321-322).
    expect(hasNonUnitScale3D('Transform3D(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)')).toBe(true);
  });

  it.each(['inf', '-inf', 'inf_neg'])('reports an infinite component (%s)', (spelling) => {
    // get_scale's column magnitude is infinite, and `is_equal_approx(inf, 1)`
    // fails both the exact branch and `abs(inf - 1) < inf`.
    expect(hasNonUnitScale3D(withFirstComponent(spelling))).toBe(true);
  });

  it('reports a nan component, from the axes that do not carry it', () => {
    // The determinant is NaN, SIGN takes neither comparison and returns 0, so
    // get_scale is (nan, 0, 0). The NaN axis is not equal-approx to 1 because
    // every comparison against NaN is false, and the other two are a unit away.
    expect(hasNonUnitScale3D(withFirstComponent('nan'))).toBe(true);
  });

  it('stays quiet on a literal the strict parser already rejects', () => {
    expect(hasNonUnitScale3D('Transform3D(1, 0, 0)')).toBe(false);
  });
});

describe('isOrthonormalTransform', () => {
  it('accepts the identity and a rotation, refuses scale and shear', () => {
    expect(isOrthonormalTransform(IDENTITY)).toBe(true);
    expect(isOrthonormalTransform('Transform3D(0, -1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0)')).toBe(true);
    expect(isOrthonormalTransform('Transform3D(2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBe(false);
    expect(isOrthonormalTransform('Transform3D(1, 0.5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBe(false);
  });

  it('refuses a non-finite basis rather than calling it unparseable', () => {
    // `length_squared()` of the inf column is inf, so basis.cpp:107's
    // `is_equal_approx(x.length_squared(), 1)` is false.
    expect(isOrthonormalTransform(withFirstComponent('inf'))).toBe(false);
    // NaN, again by every comparison against it being false.
    expect(isOrthonormalTransform(withFirstComponent('nan'))).toBe(false);
  });

  it('answers null for a literal that does not parse', () => {
    expect(isOrthonormalTransform('Transform3D(1, 0, 0)')).toBeNull();
  });
});
