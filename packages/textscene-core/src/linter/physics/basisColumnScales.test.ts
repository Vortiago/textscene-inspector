/**
 * `Basis::get_scale()` over a serialised `Transform3D`, in both the unsigned
 * pairwise form and the signed rigid-body one.
 *
 * The non-finite cases are the reason this file exists. `get_scale` is
 * `SIGN(determinant()) * get_scale_abs()` (basis.cpp:321-322), so ONE `nan`
 * component reaches all three axes: `SIGN` fails both of its comparisons on a
 * NaN determinant and returns 0 (typedefs.h:123-126), which leaves the `nan`
 * axis NaN and collapses the other two to exact 0. Reading the columns
 * independently gets every one of those wrong.
 */

import { describe, expect, it } from 'vitest';
import { basisColumnScales, basisColumnScalesGodotFloat } from './basisColumnScales.js';

/** A row-major `Transform3D` literal — the order `variant_parser.cpp:2114-2121` writes. */
function t(...rows: (number | string)[]): string {
  return `Transform3D(${[...rows, 0, 0, 0].join(', ')})`;
}

describe('basisColumnScales', () => {
  it('reads the column magnitudes of an identity basis', () => {
    expect(basisColumnScales(t(1, 0, 0, 0, 1, 0, 0, 0, 1))).toEqual([1, 1, 1]);
  });

  it('stays UNSIGNED, so a mirrored basis still reads (1, 1, 1)', () => {
    // `det_sign` cancels out of the pairwise equality its callers run
    // (collision_shape_3d.cpp:154), so the magnitudes are the whole answer.
    expect(basisColumnScales(t(-1, 0, 0, 0, 1, 0, 0, 0, 1))).toEqual([1, 1, 1]);
  });

  it('collapses a degenerate basis to (0, 0, 0), however unequal its columns', () => {
    // `SIGN(0)` is 0 (typedefs.h:123-126), so `get_scale` zeroes every axis and
    // the basis reads as uniform.
    expect(basisColumnScales(t(0, 0, 0, 0, 2, 0, 0, 0, 7))).toEqual([0, 0, 0]);
  });

  it('reads a non-finite component, which Godot reads a scale off too', () => {
    // The finite grammar refused these, so the non-uniform-scale rules went
    // silent on a basis the engine warns about.
    expect(basisColumnScales(t('inf', 0, 0, 0, 1, 0, 0, 0, 1))).toEqual([Infinity, 1, 1]);
    // Unsigned, so the `nan` axis stays NaN where `get_scale`'s SIGN(NaN) == 0
    // zeroes the other two. Both readings are non-uniform, which is the only
    // question the callers ask.
    expect(basisColumnScales(t('nan', 0, 0, 0, 1, 0, 0, 0, 1))).toEqual([NaN, 1, 1]);
  });

  it('returns null for a malformed literal rather than throwing', () => {
    expect(basisColumnScales('Transform3D(1, 0)')).toBeNull();
    expect(basisColumnScales('not a transform')).toBeNull();
  });
});

describe('basisColumnScalesGodotFloat', () => {
  it('reads the column magnitudes of an identity basis', () => {
    expect(basisColumnScalesGodotFloat(t(1, 0, 0, 0, 1, 0, 0, 0, 1))).toEqual([1, 1, 1]);
  });

  it('is SIGNED, so a mirrored basis reads (-1, -1, -1)', () => {
    // rigid_body_3d.cpp:666 compares each axis against 1.0, which does not
    // cancel `det_sign` the way a pairwise test does.
    expect(basisColumnScalesGodotFloat(t(-1, 0, 0, 0, 1, 0, 0, 0, 1))).toEqual([-1, -1, -1]);
  });

  it('collapses a degenerate basis to (0, 0, 0)', () => {
    expect(basisColumnScalesGodotFloat(t(0, 0, 0, 0, 2, 0, 0, 0, 7))).toEqual([0, 0, 0]);
  });

  it('leaves an infinite axis infinite and the finite ones at their magnitude', () => {
    expect(basisColumnScalesGodotFloat(t('inf', 0, 0, 0, 1, 0, 0, 0, 1))).toEqual([
      Infinity,
      1,
      1,
    ]);
  });

  it('zeroes the OTHER two axes for a `nan` component, because SIGN(nan) is 0', () => {
    // The whole point of the signed form. `SIGN` takes neither comparison on a
    // NaN determinant (typedefs.h:123-126), so `det_sign` is 0 and
    // `det_sign * get_scale_abs()` is (nan, 0, 0) — the nan axis compares false
    // against 1.0 and the two zeroed ones compare true, so
    // `rigidbody3d-scale-overridden-at-runtime` still fires.
    expect(basisColumnScalesGodotFloat(t('nan', 0, 0, 0, 1, 0, 0, 0, 1))).toEqual([NaN, 0, 0]);
  });

  it('signs the determinant with Godot’s own grouping, which `inf` can tell apart', () => {
    // `Basis::determinant()` (basis.h:350-354) expands along the first COLUMN.
    // Expanding along the first ROW is the same number for every finite basis
    // and NOT for this one: the column form reaches `1 - 0*inf + 1*inf` = NaN,
    // signing to 0, while the row form reaches `1 + inf` = inf, signing to +1
    // and reporting magnitudes Godot never holds.
    expect(basisColumnScalesGodotFloat(t(1, 'inf', 0, 0, 1, 1, 1, 0, 1))).toEqual([0, NaN, 0]);
  });

  it('returns null for a malformed literal', () => {
    expect(basisColumnScalesGodotFloat('Transform3D(1, 0)')).toBeNull();
  });
});
