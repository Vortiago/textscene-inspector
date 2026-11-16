import { GodotCrash } from '../../variant/cInteger.js';
import { append, MAX_TEXT_LENGTH, substr, UnrepresentableText } from './codes.js';
import { find, type Fold } from './search.js';

/** `_replace_common` (ustring.cpp:3601): each match that does not overlap, left to right. */
export function replace(
  codes: readonly number[],
  key: readonly number[],
  replacement: readonly number[],
  fold: Fold
) {
  if (key.length === 0 || codes.length === 0) return [...codes];
  const result: number[] = [];
  let last = 0;
  for (let at = find(codes, key, 0, fold); at >= 0; at = find(codes, key, at + key.length, fold)) {
    append(result, codes.slice(last, at), replacement);
    last = at + key.length;
  }
  return append(result, codes.slice(last));
}

/** `String::replace_first` (ustring.cpp:3728). */
export function replaceFirst(
  codes: readonly number[],
  key: readonly number[],
  replacement: readonly number[]
) {
  const at = find(codes, key);
  return at < 0 ? [...codes] : [...codes.slice(0, at), ...replacement, ...codes.slice(at + key.length)];
}

/** `_replace_chars_common` and `replace_char` (ustring.cpp:3802, 3840). */
export function replaceCodes(
  codes: readonly number[],
  keys: readonly number[],
  replacement: number
): number[] {
  if (replacement === 0 || (keys.length === 1 && keys[0] === 0)) return [...codes];
  return codes.map((code) => (keys.includes(code) ? replacement : code));
}

/** `String::remove_char` and `remove_chars` (ustring.cpp:2901, 3006): each code in `keys` goes. */
export const removeCodes = (codes: readonly number[], keys: readonly number[]): number[] =>
  codes.filter((code) => !keys.includes(code));

const INT32_MAX = 2 ** 31 - 1;

/** `String::repeat` (ustring.cpp:3913): an empty text for a negative or zero count. */
export function repeat(codes: readonly number[], times: number): number[] {
  if (times <= 0) return [];
  const length = times * codes.length;
  // `resize_uninitialized(p_count * len + 1)` wraps past INT32_MAX, and the copy then writes past the buffer.
  if (length + 1 > INT32_MAX)
    throw new GodotCrash(`String::repeat of ${codes.length} characters ${times} times`);
  if (length > MAX_TEXT_LENGTH) throw new UnrepresentableText(`a String of ${length} characters`);
  return Array.from({ length: times }, () => codes).flat();
}

/** `String::insert` (ustring.cpp:2852): `what` at `position`, at the end past it, and nothing below 0. */
export function insert(codes: readonly number[], position: number, what: readonly number[]): number[] {
  if (position < 0 || what.length === 0) return [...codes];
  const at = Math.min(position, codes.length);
  return [...codes.slice(0, at), ...what, ...codes.slice(at)];
}

/** `String::erase` (ustring.cpp:2884): empty for a negative argument. */
export function erase(codes: readonly number[], position: number, count: number): number[] {
  if (position < 0 || count < 0) return [];
  return [...left(codes, position), ...substr(codes, (position + count) | 0)];
}

/** `String::left` (ustring.cpp:3948): a negative length counts back from the end. */
export function left(codes: readonly number[], length: number): number[] {
  const kept = length < 0 ? (codes.length + length) | 0 : length;
  return kept <= 0 ? [] : codes.slice(0, kept);
}

/** `String::right` (ustring.cpp:3965). */
export function right(codes: readonly number[], length: number): number[] {
  const kept = length < 0 ? (codes.length + length) | 0 : length;
  if (kept <= 0) return [];
  return kept >= codes.length ? [...codes] : codes.slice(codes.length - kept);
}

const NEWLINE = 0x0a;

/** `String::indent` (ustring.cpp:4006): `prefix` before each line that is not empty. */
export function indent(codes: readonly number[], prefix: readonly number[]): number[] {
  const result: number[] = [];
  let lineStart = 0;
  codes.forEach((code, at) => {
    if (code !== NEWLINE) return;
    if (at === lineStart) result.push(code);
    else append(result, prefix, substr(codes, lineStart, at - lineStart + 1));
    lineStart = at + 1;
  });
  if (lineStart !== codes.length) append(result, prefix, substr(codes, lineStart));
  return result;
}

const isBlank = (code: number) => code <= 32;

/** `String::dedent` (ustring.cpp:4027): the first indented line's indent goes from each line. */
export function dedent(codes: readonly number[]): number[] {
  const result: number[] = [];
  let firstIndent: number[] | undefined;
  let hasText = false;
  let lineStart = 0;
  let indentStop = -1;
  codes.forEach((code, at) => {
    if (code === NEWLINE) {
      if (hasText) append(result, substr(codes, indentStop, at - indentStop));
      result.push(NEWLINE);
      hasText = false;
      lineStart = at + 1;
      indentStop = -1;
      return;
    }
    if (hasText) return;
    if (!isBlank(code)) {
      hasText = true;
      if (!firstIndent) {
        firstIndent = substr(codes, lineStart, at - lineStart);
        indentStop = at;
      }
    }
    if (firstIndent && indentStop < 0) {
      const column = at - lineStart;
      if (column >= firstIndent.length || code !== firstIndent[column]) indentStop = at;
    }
  });
  if (hasText) append(result, substr(codes, indentStop, codes.length - indentStop));
  return result;
}

/** `String::strip_edges` (ustring.cpp:4070): each code at or below 32 goes from the chosen ends. */
export function stripEdges(codes: readonly number[], fromLeft: boolean, fromRight: boolean): number[] {
  let start = 0;
  let end = codes.length;
  if (fromLeft) while (start < end && isBlank(codes[start]!)) start++;
  if (fromRight) while (end > 0 && isBlank(codes[end - 1]!)) end--;
  return start >= end ? [] : codes.slice(start, end);
}

/** `String::strip_escapes` (ustring.cpp:4101): each code below 32 goes. */
export const stripEscapes = (codes: readonly number[]): number[] => codes.filter((code) => code >= 32);

/** `String::lstrip` (ustring.cpp:4114). */
export function leftStrip(codes: readonly number[], chars: readonly number[]): number[] {
  let start = 0;
  while (start < codes.length && chars.includes(codes[start]!)) start++;
  return codes.slice(start);
}

/** `String::rstrip` (ustring.cpp:4131). */
export function rightStrip(codes: readonly number[], chars: readonly number[]): number[] {
  let end = codes.length;
  while (end > 0 && chars.includes(codes[end - 1]!)) end--;
  return codes.slice(0, end);
}
