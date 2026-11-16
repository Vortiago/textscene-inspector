import { findLower } from '../caseMapping.js';
import { substr } from './codes.js';

export type Fold = (code: number) => number;
export const unfolded: Fold = (code) => code;

const isRunAt = (codes: readonly number[], at: number, key: readonly number[], fold: Fold) =>
  key.every((code, index) => fold(codes[at + index]!) === fold(code));

/** The start a search from `from` takes: a negative `from` counts back from the last place `key` fits. */
function searchStart(length: number, keyLength: number, from: number): number | undefined {
  const start = from < 0 ? (length - keyLength + from + 1) | 0 : from;
  return start < 0 || start > length - keyLength || keyLength === 0 ? undefined : start;
}

/** `String::find` and `findn` (ustring.cpp:3036, 3123): the first start at or after `from`, or -1. */
export function find(
  codes: readonly number[],
  key: readonly number[],
  from = 0,
  fold: Fold = unfolded
): number {
  const start = searchStart(codes.length, key.length, from);
  if (start === undefined) return -1;
  for (let at = start; at <= codes.length - key.length; at++) if (isRunAt(codes, at, key, fold)) return at;
  return -1;
}

/** `String::rfind` and `rfindn` (ustring.cpp:3168, 3216): the last start at or before `from`, or -1. */
export function rfind(
  codes: readonly number[],
  key: readonly number[],
  from = -1,
  fold: Fold = unfolded
): number {
  const start = searchStart(codes.length, key.length, from);
  if (start === undefined) return -1;
  for (let at = start; at >= 0; at--) if (isRunAt(codes, at, key, fold)) return at;
  return -1;
}

/** `String::_count` (ustring.cpp:3359): matches that do not overlap, and a `to` of 0 is the end. */
export function count(
  codes: readonly number[],
  key: readonly number[],
  from: number,
  to: number,
  fold: Fold
): number {
  if (key.length === 0 || codes.length < key.length || from < 0 || to < 0) return 0;
  const end = to === 0 ? codes.length : to;
  if (to !== 0 && from >= to) return 0;
  const range = from === 0 && end === codes.length ? codes : substr(codes, from, (end - from) | 0);
  let matches = 0;
  for (let at = find(range, key, 0, fold); at !== -1; at = find(range, key, at + key.length, fold)) matches++;
  return matches;
}

/** The fold `findn`, `rfindn` and `countn` compare by. */
export const lowerCase: Fold = findLower;

/** `String::get_slice_count` (ustring.cpp:821). */
export function sliceCount(codes: readonly number[], splitter: readonly number[]): number {
  if (codes.length === 0 || splitter.length === 0) return 0;
  let slices = 1;
  for (let at = find(codes, splitter); at >= 0; at = find(codes, splitter, at + splitter.length)) slices++;
  return slices;
}

/** `String::get_slice` (ustring.cpp:860): whole without `splitter`, and empty past the last slice. */
export function slice(codes: readonly number[], splitter: readonly number[], index: number): number[] {
  if (codes.length === 0 || splitter.length === 0 || index < 0) return [];
  if (find(codes, splitter) === -1) return [...codes];
  let start = 0;
  for (let at = 0; ; at++) {
    const found = find(codes, splitter, start);
    const end = found === -1 ? codes.length : found;
    if (at === index) return substr(codes, start, end - start);
    if (end === codes.length) return [];
    start = end + splitter.length;
  }
}

/** `String::get_slicec` (ustring.cpp:941): the slices split at one code. */
export function sliceAtCode(codes: readonly number[], splitter: number, index: number): number[] {
  if (codes.length === 0 || index < 0) return [];
  let start = 0;
  let slices = 0;
  for (let at = 0; ; at++) {
    const code = codes[at] ?? 0;
    if (code !== 0 && code !== splitter) continue;
    if (slices === index) return substr(codes, start, at - start);
    if (code === 0) return [];
    slices++;
    start = at + 1;
  }
}

/** `String::_base_is_subsequence_of` (ustring.cpp:3445): whether `codes` appear in `text` in order. */
export function isSubsequence(codes: readonly number[], text: readonly number[], fold: Fold): boolean {
  if (codes.length === 0) return true;
  if (codes.length > text.length) return false;
  let next = 0;
  for (const code of text) {
    if (fold(codes[next]!) !== fold(code)) continue;
    next++;
    if (next === codes.length) return true;
  }
  return false;
}

/** `String::bigrams` (ustring.cpp:3479): each pair of neighbouring codes. */
export const bigrams = (codes: readonly number[]): number[][] =>
  codes.slice(1).map((code, index) => [codes[index]!, code]);

/** `String::similarity` (ustring.cpp:3494): the Sørensen-Dice coefficient of the bigrams, in float. */
export function similarity(codes: readonly number[], other: readonly number[]): number {
  if (codes.length === other.length && codes.every((code, index) => code === other[index])) return 1;
  if (codes.length < 2 || other.length < 2) return 0;
  const otherPairs = bigrams(other);
  const shared = bigrams(codes).filter(([first, second]) =>
    otherPairs.some(([a, b]) => a === first && b === second)
  ).length;
  return Math.fround((2 * shared) / (codes.length - 1 + other.length - 1));
}
