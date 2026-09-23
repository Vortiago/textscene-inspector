/**
 * The BOOL/INT/FLOAT cross-spellings are values Godot stores, so no validator
 * may report one as a format error.
 */

import { describe, it, expect } from 'vitest';
import { v } from './v.js';
import { maskedBitField } from './maskedBitField.js';

describe('a boolean slot given a number', () => {
  it('does not report the format error Godot has no counterpart for', () => {
    const error = v.boolean('visible')('visible', '0', 1);
    expect(error?.severity).not.toBe('error');
  });

  it('warns that the stored value is not the written spelling', () => {
    const error = v.boolean('visible')('visible', '0', 1);
    expect(error?.severity).toBe('warning');
    expect(error?.message).toContain('false');
  });

  it('still refuses a spelling the slot does not convert', () => {
    expect(v.boolean('visible')('visible', '"yes"', 1)?.severity).toBe('error');
  });

  it('accepts the canonical spellings silently', () => {
    expect(v.boolean('visible')('visible', 'true', 1)).toBeNull();
    expect(v.boolean('visible')('visible', 'false', 1)).toBeNull();
  });
});

describe('a numeric slot given a boolean', () => {
  it('reads it as 1/0 rather than reporting a format error', () => {
    expect(v.int('hframes', { min: 1, max: 16384 })('hframes', 'true', 1)?.severity).not.toBe(
      'error'
    );
    expect(v.float('rotation')('rotation', 'false', 1)?.severity).not.toBe('error');
  });

  it('feeds the converted number INTO the slot bounds, never past them', () => {
    // `false` reads as 0, which is below this slot's floor, so the bound still
    // decides, exactly as it would for a written `0`.
    const bounded = v.int('hframes', { min: 1, max: 16384 });
    expect(bounded('hframes', 'false', 1)?.severity).toBe(
      bounded('hframes', '0', 1)?.severity
    );
  });
});

/**
 * One engine behaviour, one verdict: `_to_int` maps a BOOL to 1/0 for every int
 * slot (`variant.h:361-377`), so every int reader warns about the conversion.
 */
describe('every int reader, given a boolean', () => {
  // servers/text/text_server.h:120, the same mask `maskedBitField.test.ts` uses.
  const trimFlags = maskedBitField('autowrap_trim_flags', 32 | 64 | 128, {
    enforced: 'label.cpp:63',
    labels: { 32: 'BREAK_TRIM_INDENT', 64: 'BREAK_TRIM_START', 128: 'BREAK_TRIM_END' },
  });
  type Reader = [string, ReturnType<typeof v.lenientInt>, string, string, string];
  // The spelling each reader accepts, so the probe differs from a clean value
  // in nothing but the conversion: `positiveInt` refuses the 0 that `false`
  // reads as, and bit 1 is outside the trim mask.
  const readers: readonly Reader[] = [
    ['enum', v.enumInt('cast_shadow', 0, 3, { 0: 'OFF', 1: 'ON', 2: 'DOUBLE', 3: 'SHADOWS' }), 'cast_shadow', 'true', '1'],
    ['positive-int', v.positiveInt('columns'), 'columns', 'true', '1'],
    ['strictInt', v.strictInt('frame'), 'frame', 'true', '1'],
    ['lenientInt', v.lenientInt('frame'), 'frame', 'true', '1'],
    ['bit field', trimFlags, 'autowrap_trim_flags', 'false', '0'],
  ];

  it.each(readers)(
    '%s warns that the stored value is not the spelling',
    (_at, validator, key, spelling, stored) => {
      const diagnostic = validator(key, spelling, 1);
      expect(diagnostic?.severity).toBe('warning');
      expect(diagnostic?.message).toContain(`stores ${stored}`);
    }
  );

  it('takes both spellings, wherever the slot accepts the number each reads as', () => {
    // 0 is inside `cast_shadow`'s 0-3 band and is a whole int, so nothing but
    // the conversion arm has anything to say about it.
    const castShadow = v.enumInt('cast_shadow', 0, 3, { 0: 'OFF', 1: 'ON', 2: 'DOUBLE', 3: 'SHADOWS' });
    expect(castShadow('cast_shadow', 'false', 1)?.severity).toBe('warning');
    expect(v.lenientInt('frame')('frame', 'false', 1)?.severity).toBe('warning');
    expect(v.strictInt('frame')('frame', 'false', 1)?.severity).toBe('warning');
    // The written 0 is stored as 0, so the same slot is silent about it.
    expect(castShadow('cast_shadow', '0', 1)).toBeNull();
    expect(trimFlags('autowrap_trim_flags', '0', 1)).toBeNull();
  });

  it('reports a bound or a mask ahead of the conversion, never instead of it', () => {
    // `false` is 0, below `positiveInt`'s floor; `true` is bit 1, which the
    // trim mask drops. Both outrank the warning, exactly as a bound outranks
    // the fractional one.
    expect(v.positiveInt('columns')('columns', 'false', 1)?.severity).toBe('error');
    expect(trimFlags('autowrap_trim_flags', 'true', 1)?.severity).toBe('error');
  });
});
