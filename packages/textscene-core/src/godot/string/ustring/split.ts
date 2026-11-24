import { find, rfind } from './search.js';
import { substr } from './codes.js';

/** `String::split` (ustring.cpp:1012): an empty splitter splits each code. */
export function split(
  codes: readonly number[],
  splitter: readonly number[],
  allowEmpty: boolean,
  maxSplit: number
) {
  if (codes.length === 0) return allowEmpty ? [[]] : [];
  const pieces: number[][] = [];
  for (let from = 0; ;) {
    let end = splitter.length === 0 ? from + 1 : find(codes, splitter, from);
    if (end < 0) end = codes.length;
    if (allowEmpty || end > from) {
      if (maxSplit > 0 && maxSplit === pieces.length) {
        pieces.push(substr(codes, from, codes.length));
        break;
      }
      pieces.push(substr(codes, from, end - from));
    }
    if (end === codes.length) break;
    from = end + splitter.length;
  }
  return pieces;
}

/** `String::rsplit` (ustring.cpp:1109): `split` from the end, so the first piece takes the rest. */
export function rsplit(
  codes: readonly number[],
  splitter: readonly number[],
  allowEmpty: boolean,
  maxSplit: number
) {
  const pieces: number[][] = [];
  let remaining = codes.length;
  for (;;) {
    if (remaining < splitter.length || (maxSplit > 0 && maxSplit === pieces.length)) {
      if (allowEmpty || remaining > 0) pieces.push(substr(codes, 0, remaining));
      break;
    }
    let leftEdge: number;
    if (splitter.length === 0) {
      leftEdge = remaining - 1;
      if (leftEdge === 0) leftEdge--;
    } else leftEdge = rfind(codes, splitter, remaining - splitter.length);
    if (leftEdge < 0) {
      pieces.push(substr(codes, 0, remaining));
      break;
    }
    const pieceStart = leftEdge + splitter.length;
    if (allowEmpty || pieceStart < remaining) pieces.push(substr(codes, pieceStart, remaining - pieceStart));
    remaining = leftEdge;
  }
  return pieces.reverse();
}

/** The `[from, end)` ranges `String::split_floats` (ustring.cpp:1194) reads a number from. */
export function floatRanges(codes: readonly number[], splitter: readonly number[], allowEmpty: boolean) {
  const ranges: [number, number][] = [];
  if (codes.length === 0) return ranges;
  for (let from = 0; ;) {
    let end = find(codes, splitter, from);
    if (end < 0) end = codes.length;
    if (allowEmpty || end > from) ranges.push([from, end]);
    if (end === codes.length) break;
    from = end + splitter.length;
  }
  return ranges;
}

/** `String::join` (ustring.cpp:1318). */
export const join = (separator: readonly number[], parts: readonly (readonly number[])[]): number[] =>
  parts.flatMap((part, index) => (index === 0 ? [...part] : [...separator, ...part]));
