/** The value rewrites a deprecated `_set` arm applies, on raw literal text. */

import { describe, expect, it } from 'vitest';
import { booleanized, doubledVector, isTruthy } from './deprecatedTransforms.js';

describe('doubledVector', () => {
  const twice3 = doubledVector('Vector3');
  const twice2 = doubledVector('Vector2');

  it('doubles every component and keeps the canonical jacket', () => {
    expect(twice3('Vector3(3, 1, 3)')).toBe('Vector3(6, 2, 6)');
    expect(twice2('Vector2(16, 8)')).toBe('Vector2(32, 16)');
    expect(twice3('Vector3(0.25, -1.5, 2e1)')).toBe('Vector3(0.5, -3, 40)');
  });

  it('reads the i-suffixed spelling the cast converts', () => {
    expect(twice3('Vector3i(3, 1, 3)')).toBe('Vector3(6, 2, 6)');
    expect(twice2('Vector2i(16, 8)')).toBe('Vector2(32, 16)');
  });

  it('spells non-finite and zero components as rtos_fix does', () => {
    expect(twice3('Vector3(inf, inf_neg, nan)')).toBe('Vector3(inf, -inf, nan)');
    expect(twice3('Vector3(0, -0, 1e999)')).toBe('Vector3(0, 0, inf)');
  });

  it('returns a literal it cannot read as written', () => {
    for (const raw of ['Vector2(1, 2)', 'Vector3(1, 2)', 'Vector3(1, 2, +3)', 'Vector3(a, 2, 3)', '"x"', 'null']) {
      expect(twice3(raw)).toBe(raw);
    }
    expect(twice2('Vector3(1, 2, 3)')).toBe('Vector3(1, 2, 3)');
  });
});

describe('booleanized', () => {
  // `Variant::booleanize` is `!is_zero()`: 0, an empty string and NIL are the
  // zeros; any other read spelling is true.
  it.each([
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
    ['2.5', true],
    ['"yes"', true],
    ['""', false],
    ['&"name"', true],
    ['null', false],
  ])('%s → %s', (raw, expected) => {
    expect(booleanized(raw)).toBe(expected);
  });

  it('leaves a spelling it does not read undefined, which no arm forwards', () => {
    expect(booleanized('Vector2(1, 1)')).toBeUndefined();
    expect(booleanized('SubResource("1")')).toBeUndefined();
    expect(isTruthy('SubResource("1")')).toBe(false);
  });
});
