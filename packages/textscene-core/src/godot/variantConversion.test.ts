/**
 * The conversion table both grammar builders interpolate.
 *
 * Its output is spliced straight into a `new RegExp(...)`, and every composite
 * capture index in four modules depends on the group staying NON-capturing, so
 * the shape of the emitted string is as load-bearing as its contents.
 */

import { describe, expect, it } from 'vitest';
import { compositeSpellings, isConvertedSpelling } from './variantConversion.js';
import { slotTupleRegex } from './number.js';

describe('compositeSpellings', () => {
  it('puts the declared type first, so a canonical value matches first', () => {
    expect(compositeSpellings('Vector2i')).toBe('(?:Vector2i|Vector2)');
    expect(compositeSpellings('Rect2')).toBe('(?:Rect2|Rect2i)');
  });

  it('returns the bare name for a type nothing converts into', () => {
    // A builder interpolates the result unconditionally, so this must be a
    // usable regex fragment rather than an empty group.
    expect(compositeSpellings('Color')).toBe('Color');
    expect(compositeSpellings('Transform3D')).toBe('Transform3D');
  });

  it('emits a NON-capturing group', () => {
    // `(?:` not `(`. A capturing group here would shift every `match[1..arity]`
    // read in vectors.ts, valueParsers.ts, vectorValidators.ts and v/vectors.ts
    // by one at the same time.
    expect(compositeSpellings('Vector3i').startsWith('(?:')).toBe(true);
    expect(slotTupleRegex('Vector2i', 2).exec('Vector2i(7, 8)')?.[1]).toBe('7');
    expect(slotTupleRegex('Vector2i', 2).exec('Vector2(7, 8)')?.[1]).toBe('7');
  });

  it('is symmetric — a pair converts both ways', () => {
    for (const [a, b] of [
      ['Vector2', 'Vector2i'],
      ['Vector3', 'Vector3i'],
      ['Vector4', 'Vector4i'],
      ['Rect2', 'Rect2i'],
    ]) {
      expect(isConvertedSpelling(a!, b!)).toBe(true);
      expect(isConvertedSpelling(b!, a!)).toBe(true);
    }
  });

  it('carries only the SAME-ARITY pairs', () => {
    // The reshaping conversions `can_convert_strict` also permits are
    // deliberately absent: rebuilding a Basis from a Quaternion is not a
    // rename, and no scene in a 9,626-file survey used one.
    expect(isConvertedSpelling('Transform3D', 'Transform2D')).toBe(false);
    expect(isConvertedSpelling('Basis', 'Quaternion')).toBe(false);
    expect(isConvertedSpelling('Color', 'String')).toBe(false);
  });

  it('does not answer a prototype key with a prototype member', () => {
    // `typeName` reaches here from a validator parameter, so a `.tscn` can
    // choose it. A plain object returned a function and the spread threw.
    for (const key of ['constructor', '__proto__', 'toString', 'valueOf']) {
      expect(compositeSpellings(key)).toBe(key);
      expect(isConvertedSpelling(key, 'Vector2')).toBe(false);
    }
  });
});
