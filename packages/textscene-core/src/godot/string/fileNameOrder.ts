/**
 * The order a file chooser sorts names in: `String::filenocasecmp_to` (`core/string/ustring.cpp:662-700`),
 * which `FileDialog` sorts its folders and files with (`file_dialog.h:64-67,83-86`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

const UNDERSCORE = 0x5f;
const DOT = 0x2e;
const ZERO = 0x30;

const isDigit = (code: number) => code >= ZERO && code <= 0x39;

/** `_find_upper`: the simple upper-case mapping, or the character itself where the mapping is not one code point. */
function upperOf(code: number): number {
  const upper = String.fromCodePoint(code).toUpperCase();
  const mapped = upper.codePointAt(0)!;
  return upper.length === String.fromCodePoint(mapped).length ? mapped : code;
}

/** A name as its code points, ended by 0 so a read past the end compares like Godot's terminator. */
const codePointsOf = (name: string): number[] => [...name].map((c) => c.codePointAt(0)!);

/** `natural_cmp_common`: two digit runs compared by value, leading zeros ignored (`ustring.cpp:507-546`). */
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
  if (aLength !== bLength) return [aLength < bLength ? -1 : 1, aEnd, bEnd];
  for (; aStart < aEnd; aStart++, bStart++) {
    if (a[aStart] !== b[bStart]) return [a[aStart]! < b[bStart]! ? -1 : 1, aEnd, bEnd];
  }
  return [0, aEnd, bEnd];
}

/** `naturalnocasecmp_to_base`, from the offsets the leading-underscore pass left (`ustring.cpp:605-659`). */
function naturalNoCaseCompare(a: number[], b: number[], start: number): number {
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
      const upperA = upperOf(a[i]!);
      const upperB = upperOf(b[j]!);
      if (upperA !== upperB) return upperA < upperB ? -1 : 1;
      i++;
      j++;
    }
  }
  return b[j] === undefined ? 0 : -1;
}

/**
 * Negative when `a` sorts before `b`. A leading `_` sorts below every character except `.`
 * (`file_cmp_common`), then digit runs compare by value and letters without case.
 */
export function fileNoCaseCompare(a: string, b: string): number {
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
  return naturalNoCaseCompare(left, right, at);
}
