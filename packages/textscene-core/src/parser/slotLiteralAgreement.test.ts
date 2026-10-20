/**
 * One literal in a numeric slot is one number to the linter, the rules and the decoders.
 * `_to_int` and `_to_float` map BOOL to 1 and 0 (`variant.h:361-377`), so `z_index = true`
 * stores 1 and every reader must say so.
 */

import { describe, expect, it } from 'vitest';
import { floatOr, intOr, enumOr } from './valueParsers.js';
import { readIntSlot, ruleInt, slotInt } from '../godot/variant/int.js';

const NOT_STORED = 'not stored';
type Expected = number | typeof NOT_STORED;

const INT32_SLOT_CASES: readonly [literal: string, expected: Expected][] = [
  ['true', 1],
  ['false', 0],
  ['5.5', 5],
  ['-5.9', -5],
  ['2e4', 20000],
  ['inf', NOT_STORED],
  ['nan', NOT_STORED],
  ['4294967295', -1],
];

const FALLBACK = -999;

function validatorRead(literal: string): Expected {
  const { stored } = readIntSlot(literal);
  return stored === null || Number.isNaN(stored) ? NOT_STORED : stored;
}

function ruleRead(literal: string): Expected {
  return ruleInt(literal) ?? NOT_STORED;
}

function decoderRead(literal: string): Expected {
  const read = intOr(literal, FALLBACK);
  return read === FALLBACK ? NOT_STORED : read;
}

function rendererSlotRead(literal: string): Expected {
  return slotInt(literal) ?? NOT_STORED;
}

describe.each(INT32_SLOT_CASES)('the literal %s in an int32 slot', (literal, expected) => {
  it('is read by the validator', () => {
    expect(validatorRead(literal)).toBe(expected);
  });

  it('is read by the rule reader', () => {
    expect(ruleRead(literal)).toBe(expected);
  });

  it('is read by the decoder', () => {
    expect(decoderRead(literal)).toBe(expected);
  });

  it('is read by the renderer slot reader', () => {
    expect(rendererSlotRead(literal)).toBe(expected);
  });
});

describe('the literal 4294967295 in a uint32 slot', () => {
  it('stays 4294967295 for the validator, the rule reader and the decoder', () => {
    expect(readIntSlot('4294967295', null, 'uint32').stored).toBe(4294967295);
    expect(ruleInt('4294967295', null, 'uint32')).toBe(4294967295);
    expect(intOr('4294967295', FALLBACK, 'value', 'uint32')).toBe(4294967295);
  });
});

describe('a boolean in an enum slot', () => {
  it('is the member 1 or 0, as in an int slot', () => {
    expect(enumOr('true', 0, [0, 1])).toBe(1);
    expect(enumOr('false', 1, [0, 1])).toBe(0);
  });
});

describe('a boolean in a float slot', () => {
  it('decodes to 1 and 0', () => {
    expect(floatOr('true', FALLBACK)).toBe(1);
    expect(floatOr('false', FALLBACK)).toBe(0);
  });
});
