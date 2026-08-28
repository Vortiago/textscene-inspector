/**
 * The BOOL/INT/FLOAT cross-spellings are values Godot stores, so no validator
 * may report one as a format ERROR. Measured on 4.6.3 rather than derived.
 */

import { describe, it, expect } from 'vitest';
import { v } from './v.js';

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
    // `false` reads as 0, which is below this slot's floor — so the bound still
    // decides, exactly as it would for a written `0`.
    const bounded = v.int('hframes', { min: 1, max: 16384 });
    expect(bounded('hframes', 'false', 1)?.severity).toBe(
      bounded('hframes', '0', 1)?.severity
    );
  });
});
