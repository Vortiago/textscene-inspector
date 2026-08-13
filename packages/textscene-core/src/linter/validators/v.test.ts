/**
 * Unit tests for the declarative validator namespace `v`.
 *
 * Each combinator is exercised on its happy path + at least one edge
 * (NaN, out-of-range, wrong format). The asserts pin message text the
 * same way the per-node `linter.test.ts` files do (`toContain` rather
 * than `toBe`) so they survive small wording tweaks without breaking.
 *
 * This file holds the scalar combinators. The tuple/reference ones are
 * `v.tuples.test.ts`, and the packed-array and string grammars are
 * `v.packedArrays.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { v } from './v.js';

describe('v.float', () => {
  it('passes when in range', () => {
    expect(v.float('fov', { min: 1, max: 179 })('fov', '90', 1)).toBeNull();
  });

  it('rejects NaN with format code', () => {
    const err = v.float('fov', { min: 1, max: 179 })('fov', 'oops', 5);
    expect(err).not.toBeNull();
    expect(err!.code).toBe('INVALID_FOV_FORMAT');
    expect(err!.line).toBe(5);
    expect(err!.message).toContain('fov');
    expect(err!.message).toContain('number');
  });

  it('rejects below min with value code', () => {
    const err = v.float('fov', { min: 1, max: 179 })('fov', '0.5', 1);
    expect(err!.code).toBe('INVALID_FOV_VALUE');
  });

  it('rejects above max with value code', () => {
    const err = v.float('fov', { min: 1, max: 179 })('fov', '200', 1);
    expect(err!.code).toBe('INVALID_FOV_VALUE');
  });

  it('accepts any number when no bounds set', () => {
    expect(v.float('offset')('offset', '-12.5', 1)).toBeNull();
    expect(v.float('offset')('offset', '0', 1)).toBeNull();
    expect(v.float('offset')('offset', 'not-a-number', 1)?.code).toBe(
      'INVALID_OFFSET_FORMAT'
    );
  });
});

describe('v.nonNegativeFloat', () => {
  it('accepts zero and positive', () => {
    expect(v.nonNegativeFloat('shadow_blur')('shadow_blur', '0', 1)).toBeNull();
    expect(v.nonNegativeFloat('shadow_blur')('shadow_blur', '12.5', 1)).toBeNull();
  });

  it('rejects negative', () => {
    const err = v.nonNegativeFloat('shadow_blur')('shadow_blur', '-1', 1);
    expect(err!.message).toContain('shadow_blur');
    expect(err!.message).toContain('non-negative');
  });
});

describe('v.positiveFloat', () => {
  it('rejects zero', () => {
    const err = v.positiveFloat('near')('near', '0', 1);
    expect(err).not.toBeNull();
    expect(err!.message).toContain('near');
  });

  it('accepts positive', () => {
    expect(v.positiveFloat('near')('near', '0.5', 1)).toBeNull();
  });
});

describe('v.int', () => {
  it('parses base 10', () => {
    expect(v.int('layers', { min: 1, max: 20 })('layers', '15', 1)).toBeNull();
  });

  it('rejects out-of-range', () => {
    const err = v.int('layers', { min: 1, max: 20 })('layers', '21', 1);
    expect(err!.code).toBe('INVALID_LAYERS_VALUE');
  });

  // The tokenizer sets is_float on the `e` (variant_parser.cpp:446-448) and the
  // FLOAT is truncated on assignment, so Godot stores 20000 here. `parseInt`
  // stops at the `e` and reads 2, which clears every bound the property has.
  it('reads exponent notation the way Godot stores it', () => {
    const err = v.int('hframes', { min: 1, max: 16384 })('hframes', '2e4', 1);
    expect(err).not.toBeNull();
    expect(err!.message).toContain('20000');
  });

  // Same stop-at-the-first-non-digit accident in the other direction: Godot's
  // parser cannot read this at all, and `parseInt` reads 8.
  it('rejects a trailing-garbage value Godot cannot read', () => {
    const err = v.int('hframes', { min: 1, max: 16384 })('hframes', '8abc', 1);
    expect(err!.code).toBe('INVALID_HFRAMES_FORMAT');
  });

  // A float literal in an INT slot is legal and truncates toward zero.
  it('truncates a float literal toward zero', () => {
    expect(v.int('frame', { min: 0, max: 10 })('frame', '5.9', 1)).toBeNull();
    expect(v.int('frame', { min: 1, max: 10 })('frame', '0.9', 1)).not.toBeNull();
  });
});

describe('the int combinators agree on what Godot can read', () => {
  // `inf` / `nan` are identifiers `stor_fix` (variant_parser.cpp:149-159)
  // resolves for ANY slot, so the file loads whichever combinator guards it.
  // Two int combinators giving opposite answers on one literal is a split no
  // engine line supports, and `strictInt`'s `Number.isInteger` produced exactly
  // that while `v.int` accepted it.
  // Unbounded, so this is about the FORMAT branch alone. A non-finite value
  // against a real bound is a range question and answered separately below.
  it.each(['inf', '-inf', 'inf_neg', 'nan'])('both take %s', (literal) => {
    expect(v.int('frame')('frame', literal, 1)).toBeNull();
    expect(v.strictInt('frame')('frame', literal, 1)).toBeNull();
  });

  it('bounds a non-finite the same way, once there is a bound', () => {
    // `inf` really is above a ceiling of 10; `nan` compares false against both
    // ends, so neither combinator may claim it is out of range.
    expect(v.int('frame', { max: 10 })('frame', 'inf', 1)).not.toBeNull();
    expect(v.strictInt('frame', { max: 10 })('frame', 'inf', 1)).not.toBeNull();
    expect(v.int('frame', { min: 0, max: 10 })('frame', 'nan', 1)).toBeNull();
    expect(v.strictInt('frame', { min: 0, max: 10 })('frame', 'nan', 1)).toBeNull();
  });

  it.each(['8abc', '', 'Infinity', '1.2.3'])('both refuse %o', (literal) => {
    expect(v.int('frame')('frame', literal, 1)).not.toBeNull();
    expect(v.strictInt('frame')('frame', literal, 1)).not.toBeNull();
  });

  // Where they DO differ, deliberately: `strictInt` guards a discrete index and
  // refuses a fractional literal outright, while `v.int` truncates it the way
  // the INT conversion does.
  it('still differ on a fractional literal, which is the point of strictInt', () => {
    expect(v.int('frame', { min: 0, max: 10 })('frame', '5.5', 1)).toBeNull();
    expect(v.strictInt('frame', { min: 0, max: 10 })('frame', '5.5', 1)).not.toBeNull();
  });
});

describe('v.positiveInt', () => {
  it('accepts > 0', () => {
    expect(v.positiveInt('count')('count', '5', 1)).toBeNull();
  });

  it('rejects 0 and negative', () => {
    expect(v.positiveInt('count')('count', '0', 1)).not.toBeNull();
    expect(v.positiveInt('count')('count', '-3', 1)).not.toBeNull();
  });

  // `5e-1` truncates to 0, which is the value this combinator refuses.
  it('reads exponent notation the way Godot stores it', () => {
    expect(v.positiveInt('count')('count', '5e-1', 1)).not.toBeNull();
    expect(v.positiveInt('count')('count', '2e3', 1)).toBeNull();
  });
});

describe('v.enumInt', () => {
  it('accepts values in range', () => {
    const labels = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };
    const validator = v.enumInt('cast_shadow', 0, 3, labels);
    for (const value of [0, 1, 2, 3]) {
      expect(validator('cast_shadow', String(value), 1)).toBeNull();
    }
  });

  it('rejects out-of-range with labelled message', () => {
    const labels = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };
    const err = v.enumInt('cast_shadow', 0, 3, labels)('cast_shadow', '99', 1);
    expect(err).not.toBeNull();
    expect(err!.message).toContain('cast_shadow');
    expect(err!.message).toContain('0-3');
    expect(err!.message).toContain('SHADOWS_ONLY');
  });

  it('rejects NaN with format code', () => {
    const labels = { 0: 'A', 1: 'B' };
    const err = v.enumInt('mode', 0, 1, labels)('mode', 'abc', 1);
    expect(err!.code).toBe('INVALID_MODE_FORMAT');
  });

  it('reads exponent notation the way Godot stores it', () => {
    const labels = { 0: 'A', 1: 'B' };
    const err = v.enumInt('mode', 0, 1, labels)('mode', '1e2', 1);
    expect(err).not.toBeNull();
    expect(err!.message).toContain('100');
  });
});

describe('v.boolean', () => {
  it('accepts true/false', () => {
    expect(v.boolean('disabled')('disabled', 'true', 1)).toBeNull();
    expect(v.boolean('disabled')('disabled', 'false', 1)).toBeNull();
  });

  it('rejects everything else', () => {
    const err = v.boolean('disabled')('disabled', 'yes', 1);
    expect(err!.message).toContain('disabled');
    expect(err!.message).toContain('boolean');
  });
});

describe('column offset on every code path', () => {
  // Every per-property validator returns `column: key.length + 3`.
  // This matches the per-node tests' implicit expectation when they
  // compare diagnostics shape. Pin it across one representative path.
  it('puts the column at the value position (key.length + 3)', () => {
    const err = v.float('fov')('fov', 'oops', 1);
    expect(err!.column).toBe('fov'.length + 3);
  });
});
