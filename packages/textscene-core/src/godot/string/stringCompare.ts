/**
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { findUpper } from './caseMapping';

const UNDERSCORE = 0x5f;
const DOT = 0x2e;
const ZERO = 0x30;

type Fold = (code: number) => number;
const unfolded: Fold = (code) => code;

const isDigit = (code: number) => code >= ZERO && code <= 0x39;

/** A text as its code points. A read past the end is `undefined`, which the comparisons take as Godot's terminator. */
const codePointsOf = (text: string): number[] => Array.from(text, (c) => c.codePointAt(0)!);

const sign = (difference: number) => (difference < 0 ? -1 : 1);

/** `casecmp_to` and `nocasecmp_to` (ustring.cpp:443-505): an empty text sorts first, then code by code. */
function compareCodes(a: string, b: string, fold: Fold): number {
  if (a === '' || b === '') return a === b ? 0 : a === '' ? -1 : 1;
  const left = codePointsOf(a);
  const right = codePointsOf(b);
  for (let at = 0; ; at++) {
    if (left[at] === undefined || right[at] === undefined)
      return left[at] === right[at] ? 0 : left[at] === undefined ? -1 : 1;
    const difference = fold(left[at]!) - fold(right[at]!);
    if (difference !== 0) return sign(difference);
  }
}

/** `String::casecmp_to`: -1, 0 or 1 by code point. */
export const caseCompare = (a: string, b: string): number => compareCodes(a, b, unfolded);

/** `String::nocasecmp_to`: -1, 0 or 1 by the upper case of each code point. */
export const noCaseCompare = (a: string, b: string): number => compareCodes(a, b, findUpper);

/** `natural_cmp_common` (ustring.cpp:507): two digit runs compared by value, leading zeros ignored. */
function compareDigitRuns(
  a: number[],
  i: number,
  b: number[],
  j: number
): [result: number, i: number, j: number] {
  let aEnd = i;
  let bEnd = j;
  while (isDigit(a[aEnd] ?? 0)) aEnd++;
  while (isDigit(b[bEnd] ?? 0)) bEnd++;
  let aStart = i;
  let bStart = j;
  while (a[aStart] === ZERO) aStart++;
  while (b[bStart] === ZERO) bStart++;
  const aLength = aEnd - aStart;
  const bLength = bEnd - bStart;
  if (aLength !== bLength) return [sign(aLength - bLength), aEnd, bEnd];
  for (; aStart < aEnd; aStart++, bStart++) {
    if (a[aStart] !== b[bStart]) return [sign(a[aStart]! - b[bStart]!), aEnd, bEnd];
  }
  return [0, aEnd, bEnd];
}

/** `naturalcasecmp_to_base` and `naturalnocasecmp_to_base` (ustring.cpp:549-653), from offset `start`. */
function naturalCompareFrom(a: number[], b: number[], start: number, fold: Fold): number {
  let i = start;
  let j = start;
  while (a[i] === DOT || b[j] === DOT) {
    if (a[i++] !== DOT) return 1;
    if (b[j++] !== DOT) return -1;
    if (b[j] === undefined) return 1;
    if (a[i] === undefined) return -1;
  }
  while (a[i] !== undefined) {
    if (b[j] === undefined) return 1;
    if (isDigit(a[i]!)) {
      if (!isDigit(b[j]!)) return -1;
      const [result, nextI, nextJ] = compareDigitRuns(a, i, b, j);
      if (result !== 0) return result;
      i = nextI;
      j = nextJ;
    } else if (isDigit(b[j]!)) {
      return 1;
    } else {
      const difference = fold(a[i]!) - fold(b[j]!);
      if (difference !== 0) return sign(difference);
      i++;
      j++;
    }
  }
  return b[j] === undefined ? 0 : -1;
}

/** `String::naturalcasecmp_to`: digit runs compare by value, other codes by code point. */
export const naturalCaseCompare = (a: string, b: string): number =>
  naturalCompareFrom(codePointsOf(a), codePointsOf(b), 0, unfolded);

/** `String::naturalnocasecmp_to`: digit runs compare by value, other codes by their upper case. */
export const naturalNoCaseCompare = (a: string, b: string): number =>
  naturalCompareFrom(codePointsOf(a), codePointsOf(b), 0, findUpper);

/** `file_cmp_common` (ustring.cpp:657): a leading `_` sorts below every code except `.`, then the natural order. */
function fileCompare(a: string, b: string, fold: Fold): number {
  const left = codePointsOf(a);
  const right = codePointsOf(b);
  let at = 0;
  while (
    (left[at] === UNDERSCORE && right[at] !== undefined) ||
    (left[at] !== undefined && right[at] === UNDERSCORE)
  ) {
    if (left[at] !== UNDERSCORE) return left[at] === DOT ? -1 : 1;
    if (right[at] !== UNDERSCORE) return right[at] === DOT ? 1 : -1;
    at++;
  }
  return naturalCompareFrom(left, right, at, fold);
}

/** `String::filecasecmp_to`. */
export const fileCaseCompare = (a: string, b: string): number => fileCompare(a, b, unfolded);

/**
 * `String::filenocasecmp_to`, the order `FileDialog` sorts its folders and files in (file_dialog.h:64).
 *
 * @canonical The order Godot sorts file names in
 */
export const fileNoCaseCompare = (a: string, b: string): number => fileCompare(a, b, findUpper);
