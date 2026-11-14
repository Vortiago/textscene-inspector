/**
 * ThorVG's `strToFloat` (`tvgStr.cpp:60-205`): the number at the start of a text, in single
 * precision, and where it ends. It keeps ThorVG's rules for where a number ends, which decide how
 * a path or a list of numbers splits.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { isSpace } from './xmlParser';

/** A number and the index after its last character, or the index it started at where it read none. */
export interface ParsedFloat {
  readonly value: number;
  readonly end: number;
}

/** The decimal digits ThorVG keeps after the dot: an unsigned 64-bit integer holds 19. */
const MAX_FRACTION_DIGITS = 19;

/** `FLT_MIN` as ThorVG writes it: a value it scales by `1e-38` at once, not in steps that go to zero. */
const FLOAT_MIN = Math.fround(1.175494351);

const f32 = Math.fround;

const isDigit = (character: string | undefined): boolean =>
  character !== undefined && character >= '0' && character <= '9';

const lower = (character: string | undefined): string | undefined => character?.toLowerCase();

/** The text matches `word` at `at`, case aside. */
function matchesWord(text: string, at: number, word: string): boolean {
  for (let i = 0; i < word.length; i++) if (lower(text[at + i]) !== word[i]) return false;
  return true;
}

/** An unsigned 64-bit integer rounded to the nearest float, a tie to even. */
function floatOfUint64(integer: bigint): number {
  const width = integer.toString(2).length;
  if (width <= 53) return f32(Number(integer));
  // Above 2^53 a conversion through a double rounds twice: keep 25 bits and a sticky bit instead.
  const shift = BigInt(width - 25);
  const kept = integer >> shift;
  const isSticky = (integer & ((1n << shift) - 1n)) !== 0n;
  return f32(Number(kept | (isSticky ? 1n : 0n)) * 2 ** Number(shift));
}

/** `10^exponent` as ThorVG builds it: steps of `1e8`, then of 10, each rounded to a float. */
function scaleOfExponent(exponent: number): number {
  let scale = 1;
  for (; exponent >= 8; exponent -= 8) scale = f32(scale * 1e8);
  for (; exponent > 0; exponent--) scale = f32(scale * 10);
  return scale;
}

export function strToFloat(text: string, start = 0): ParsedFloat {
  let at = start;
  while (isSpace(text[at])) at++;
  let sign = 1;
  if (text[at] === '-') {
    sign = -1;
    at++;
  } else if (text[at] === '+') {
    at++;
  }
  if (lower(text[at]) === 'i') return infinity(text, start, at, sign);
  if (lower(text[at]) === 'n') {
    if (!matchesWord(text, at, 'nan')) return { value: 0, end: start };
    return { value: NaN, end: at + 3 };
  }
  return finite(text, start, at, sign);
}

/** `inf` or `infinity`, signed, or nothing for any other word. */
function infinity(text: string, start: number, at: number, sign: number): ParsedFloat {
  if (!matchesWord(text, at, 'inf')) return { value: 0, end: start };
  at += 3;
  if (lower(text[at]) === 'i') {
    if (!matchesWord(text, at, 'inity')) return { value: 0, end: start };
    at += 5;
  }
  return { value: sign * Infinity, end: at };
}

/** The digits, fraction and exponent of a number, where `end` follows ThorVG's `a` pointer. */
function finite(text: string, start: number, at: number, sign: number): ParsedFloat {
  let end = start;
  let integer = 0n;
  if (isDigit(text[at])) {
    for (; isDigit(text[at]); at++)
      integer = BigInt.asUintN(64, integer * 10n + BigInt(text.charCodeAt(at) - 48));
    end = at;
  } else if (text[at] !== '.') {
    return { value: 0, end };
  }
  let value = floatOfUint64(integer);
  if (text[at] === '.') {
    at++;
    if (!isDigit(text[at]) && isSpace(text[at])) return signed(value, at, sign);
    let fraction = 0n;
    let power = 1n;
    for (let count = 0; isDigit(text[at]); at++, count++) {
      if (count >= MAX_FRACTION_DIGITS) continue;
      fraction = fraction * 10n + BigInt(text.charCodeAt(at) - 48);
      power *= 10n;
    }
    value = f32(value + f32(floatOfUint64(fraction) / floatOfUint64(power)));
    end = at;
  }
  if (text[at] === 'e' || text[at] === 'E') return withExponent(text, start, at + 1, end, value, sign);
  if (at > start && !isDigit(text[at - 1])) return signed(value, start, sign);
  return signed(value, end, sign);
}

/** The exponent after `e`, or `em` read as a unit ThorVG ignores. */
function withExponent(
  text: string,
  start: number,
  at: number,
  end: number,
  value: number,
  sign: number
): ParsedFloat {
  if (text[at] === 'm' || text[at] === 'M') return signed(value, at + 1, sign);
  let exponentSign = 1;
  if (text[at] === '-') {
    exponentSign = -1;
    at++;
  } else if (text[at] === '+') {
    at++;
  }
  let exponent = 0;
  if (isDigit(text[at])) {
    for (; isDigit(text[at]); at++) exponent = (exponent * 10 + text.charCodeAt(at) - 48) >>> 0;
  } else if (!isDigit(text[end - 1])) {
    return signed(value, start, sign);
  } else if (at >= text.length) {
    return signed(value, end, sign);
  }
  if (value === FLOAT_MIN && exponentSign * exponent <= -38) return signed(f32(value * f32(1e-38)), at, sign);
  const scale = scaleOfExponent(exponent);
  return signed(exponentSign === -1 ? f32(value / scale) : f32(value * scale), at, sign);
}

/** ThorVG's `success` label: a value that is not finite reads as zero. */
function signed(value: number, end: number, sign: number): ParsedFloat {
  return { value: Number.isFinite(value) ? sign * value : 0, end };
}
