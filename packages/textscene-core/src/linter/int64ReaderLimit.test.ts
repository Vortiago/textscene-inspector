/**
 * An int64 slot past 2^53 is this reader's limit, never an engine alteration:
 * `_to_int` carries `9007199254740993` intact and `String::to_int` saturates
 * (`ustring.cpp:2650-2658`). Both code paths are pinned: the scalar one through
 * `unrepresentableInt`, the packed-element one through `badIntElement`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import './index.js';

/** The first diagnostic a registered validator gives `value` for `key`. */
function check(nodeType: string, key: string, value: string) {
  const validator = validatorRegistry.findValidator(nodeType, key);
  expect(validator, `no validator registered for ${nodeType}.${key}`).not.toBeNull();
  return validator!(key, value, 1);
}

/** 2^53 + 1: the smallest integer a double cannot spell, and an exact int64. */
const PAST_DOUBLE = '9007199254740993';

describe('int64 slots past the reader’s range', () => {
  // `BitField<T>` is int64 (maskedBitField reads at that width), so this value
  // is one Godot stores exactly.
  it('does not claim the engine cannot hold a scalar int64 value', () => {
    const error = check('Label', 'autowrap_trim_flags', PAST_DOUBLE);
    expect(error?.severity).toBe('warning');
    expect(error?.message).not.toContain('cannot be stored in an integer slot');
    expect(error?.message).toContain('this linter reads exactly');
  });

  it('does not claim the engine cannot hold an int64 array element', () => {
    // The bare `[…]` spelling reads at int64; `PackedInt32Array(…)` is int32.
    const error = check('CodeEdit', 'line_length_guidelines', `[${PAST_DOUBLE}]`);
    expect(error?.severity).toBe('warning');
    expect(error?.message).not.toContain('no integer can hold');
    expect(error?.message).toContain('this linter reads exactly');
  });

  // A uint8, int32 or uint32 slot is narrower than a double, so the engine
  // alters the value and the error tier is earned.
  it('still errors where the C++ type really is narrower than the value', () => {
    const error = check('Node2D', 'z_index', '4294967296');
    expect(error?.severity).toBe('error');
  });

  // "Finite" is not the test. Past 2^63 the value leaves int64's own range: a
  // float literal is undefined behaviour (`variant.h:369-370`) and an int one
  // saturates (`ustring.cpp:2650-2658`). Both are alterations, so both error.
  it('still errors past int64 itself, where the engine does alter the value', () => {
    expect(check('CodeEdit', 'line_length_guidelines', '[1e20]')?.severity).toBe('error');
    expect(check('Label', 'autowrap_trim_flags', '1e20')?.severity).toBe('error');
  });

  it('still errors on a non-finite literal in an int64 slot', () => {
    // `inf` reads (`variant_parser.cpp:701-707`) and is then altered on the
    // write, so this one is a genuine alteration at every width.
    const error = check('Label', 'autowrap_trim_flags', 'inf');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('cannot be stored in an integer slot');
  });
});
