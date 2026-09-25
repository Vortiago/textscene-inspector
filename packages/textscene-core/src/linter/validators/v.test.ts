/**
 * The scalar combinators of the validator namespace `v`, each on its happy path
 * and at least one edge. Messages are pinned with `toContain`, as the per-node
 * `linter.test.ts` files do. Tuples live in `v.tuples.test.ts`, packed arrays
 * and strings in `v.packedArrays.test.ts`.
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

  // Godot's parser cannot read this at all, while `parseInt` reads 8.
  it('rejects a trailing-garbage value Godot cannot read', () => {
    const err = v.int('hframes', { min: 1, max: 16384 })('hframes', '8abc', 1);
    expect(err!.code).toBe('INVALID_HFRAMES_FORMAT');
  });

  // A float literal in an INT slot loads and truncates toward zero, which
  // warns. It is judged after the bounds, so `0.9` under a floor of 1 keeps
  // its range error.
  it('warns that a float literal is truncated toward zero', () => {
    expect(v.int('frame', { min: 0, max: 10 })('frame', '5.9', 1)?.severity).toBe('warning');
    expect(v.int('frame', { min: 1, max: 10 })('frame', '0.9', 1)?.severity).toBe('error');
  });
});

describe('the int combinators agree on what Godot can read', () => {
  // Both combinators read all four spellings: the tokenizer resolves them for a
  // bare slot too (variant_parser.cpp:701-707), so neither may call it a format
  // error. What they report is a value question, answered below.
  it.each(['inf', '-inf', 'inf_neg', 'nan'])('neither calls %s a format error', (literal) => {
    expect(v.int('frame')('frame', literal, 1)?.code).not.toBe('INVALID_FRAME_FORMAT');
    expect(v.strictInt('frame')('frame', literal, 1)?.code).not.toBe('INVALID_FRAME_FORMAT');
  });

  it.each(['inf', '-inf', 'inf_neg', 'nan'])('both report %s as altered in an INT slot', (literal) => {
    // `Vector2i(inf, 8)` and its three siblings all store `(-2147483648, 8)`:
    // the narrowing at parse time is an alteration, the error tier. A float
    // slot stores it verbatim and stays silent, the case directly below.
    expect(v.int('frame')('frame', literal, 1)?.severity).toBe('error');
    expect(v.strictInt('frame')('frame', literal, 1)?.severity).toBe('error');
    expect(v.float('weight')('weight', literal, 1)).toBeNull();
  });

  it('reports the alteration rather than a bound it cannot compare', () => {
    // The message must not name the stored number: the C++ narrowing is UB, so
    // only the alteration is portable, and `nan` and `inf` read alike.
    for (const literal of ['inf', 'nan']) {
      const reported = v.int('frame', { min: 0, max: 10 })('frame', literal, 1);
      expect(reported?.severity).toBe('error');
      expect(reported?.message).not.toContain('2147483648');
      expect(reported?.message).toContain('integer slot');
    }
  });

  it.each(['8abc', '', 'Infinity', '1.2.3'])('both refuse %o', (literal) => {
    expect(v.int('frame')('frame', literal, 1)).not.toBeNull();
    expect(v.strictInt('frame')('frame', literal, 1)).not.toBeNull();
  });

  // And on a fractional literal too: one engine behaviour, one verdict.
  it('agree on a fractional literal, which the INT conversion truncates', () => {
    for (const validator of [v.int('frame', { min: 0, max: 10 }), v.strictInt('frame', { min: 0, max: 10 })]) {
      const diagnostic = validator('frame', '5.5', 1);
      expect(diagnostic?.severity).toBe('warning');
      expect(diagnostic?.code).toBe('INVALID_FRAME_VALUE');
    }
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
  // Every per-property validator returns `column: key.length + 3`, which the
  // per-node tests expect. Pin it across one representative path.
  it('puts the column at the value position (key.length + 3)', () => {
    const err = v.float('fov')('fov', 'oops', 1);
    expect(err!.column).toBe('fov'.length + 3);
  });
});
