/**
 * Reads the packed-nibble real number of a DICT (Technical Note 5176 Table 5) the way
 * `cff_parse_real` (cffparse.c) does. It keeps the digits it reads (nine after the point at most),
 * so the font matrix reader can scale them, and it derives the double from them, so that a real has
 * one reader.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

/** FreeType keeps at most nine digits after the point, and gives up on an exponent beyond 1000. */
const MAX_FRACTION_DIGITS = 9;
const MAX_EXPONENT = 1000;

/** Past this, another digit would overflow the 32-bit number FreeType accumulates: it counts a power of ten instead. */
const DIGIT_LIMIT = 0xccccccc;

const END_OF_DATA = -1;
const TERMINATOR_NIBBLE = 0xf;

/** The digits of a real: its value is `number` times ten to the `exponent` minus `fractionLength`. */
export interface RealDigits {
  readonly isNegative: boolean;
  readonly number: number;
  /** The exponent written in the real, plus one for each integer digit dropped and minus one for each zero before the first digit. */
  readonly exponent: number;
  readonly integerLength: number;
  readonly fractionLength: number;
  /** Whether the written exponent was beyond what FreeType reads, and in which direction. */
  readonly overflow: 'none' | 'large' | 'small';
}

/** Whether a read of `size` bytes at `at` crosses `limit`, which FreeType tests with `p + size > limit && limit >= p`. */
const crosses = (at: number, size: number, limit: number): boolean => at + size > limit && limit >= at;

/** The digits of the real whose operator `30` is at `start`, or null where the data ends before the number does. */
export function readRealDigits(dv: DataView, start: number, limit: number): RealDigits | null {
  let at = start;
  let phase = 4;
  const nextNibble = (): number => {
    if (phase) {
      at++;
      if (crosses(at, 1, limit)) return END_OF_DATA;
    }
    const nibble = (dv.getUint8(at) >> phase) & 0xf;
    phase = 4 - phase;
    return nibble;
  };

  let isNegative = false;
  let hasOverflow = false;
  let number = 0;
  let exponent = 0;
  let exponentAdd = 0;
  let integerLength = 0;
  let fractionLength = 0;

  let nibble = nextNibble();
  for (; nibble !== END_OF_DATA; nibble = nextNibble()) {
    if (nibble === 0xe) isNegative = true;
    else if (nibble > 9) break;
    else if (number >= DIGIT_LIMIT) exponentAdd++;
    else if (nibble || number) {
      integerLength++;
      number = number * 10 + nibble;
    }
  }
  if (nibble === 0xa) {
    for (nibble = nextNibble(); nibble !== END_OF_DATA && nibble < 10; nibble = nextNibble()) {
      if (!nibble && !number) exponentAdd--;
      else if (number < DIGIT_LIMIT && fractionLength < MAX_FRACTION_DIGITS) {
        fractionLength++;
        number = number * 10 + nibble;
      }
    }
  }
  let isExponentNegative = false;
  if (nibble === 0xc) {
    isExponentNegative = true;
    nibble = 0xb;
  }
  if (nibble === 0xb) {
    for (nibble = nextNibble(); nibble !== END_OF_DATA && nibble < 10; nibble = nextNibble()) {
      if (exponent > MAX_EXPONENT) hasOverflow = true;
      else exponent = exponent * 10 + nibble;
    }
    if (isExponentNegative) exponent = -exponent;
  }
  if (nibble === END_OF_DATA) return null;
  const overflow = hasOverflow ? (isExponentNegative ? 'small' : 'large') : 'none';
  return { isNegative, number, exponent: exponent + exponentAdd, integerLength, fractionLength, overflow };
}

/** The real whose operator `30` is at `start` as a double, 0 where the data ends before the number does. */
export function readRealValue(dv: DataView, start: number, limit: number): number {
  const digits = readRealDigits(dv, start, limit);
  if (!digits) return 0;
  const sign = digits.isNegative ? '-' : '';
  if (digits.overflow === 'large') return Number(`${sign}Infinity`);
  if (digits.overflow === 'small') return 0;
  // The text of the number, not a product with a power of ten: it rounds as a literal does.
  return Number(`${sign}${digits.number}e${digits.exponent - digits.fractionLength}`);
}

/** Where the DICT goes on after the real whose operator `30` is at `start`: the byte after the first one that holds a terminating nibble. */
export function realEnd(dv: DataView, start: number): number {
  for (let at = start + 1; ; at++) {
    const byte = dv.getUint8(at);
    if (byte >> 4 === TERMINATOR_NIBBLE || (byte & 0xf) === TERMINATOR_NIBBLE) return at + 1;
  }
}
