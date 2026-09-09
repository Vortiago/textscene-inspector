/**
 * `globalScale` against `Transform2D::get_scale()` (transform_2d.cpp:115-118),
 * where the y column's length carries the shared determinant's sign.
 */

import { describe, expect, it } from 'vitest';
import { globalScale } from './node2dGlobalTransform.js';

describe('globalScale', () => {
  it('signs the y column by the determinant', () => {
    expect(globalScale({ a: 2, b: 0, c: 0, d: 3, tx: 0, ty: 0 })).toEqual({ x: 2, y: 3 });
    // A flip puts the determinant negative, and the y length follows it.
    expect(globalScale({ a: 2, b: 0, c: 0, d: -3, tx: 0, ty: 0 })).toEqual({ x: 2, y: -3 });
  });

  it('reads a degenerate transform as zero scale on y', () => {
    // `SIGN(0)` is 0 (typedefs.h:123-126), so a zero determinant zeroes the
    // signed half rather than leaving it unsigned.
    expect(globalScale({ a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('reads a NaN determinant the way SIGN does, as zero', () => {
    // `SIGN` is `m_v > 0 ? +1 : (m_v < 0 ? -1 : 0)` (typedefs.h:123-126): both
    // comparisons are false for NaN, so it falls through to 0 — where
    // `Math.sign` returns NaN and poisons a y column that is perfectly finite.
    // Reachable, not theoretical: `nan` is a float literal Godot writes and
    // reloads, so `scale = Vector2(nan, 1)` parses and lands here.
    const nanDeterminant = { a: NaN, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    expect(globalScale(nanDeterminant).y).toBe(0);
  });
});
