/**
 * The indices of an indexed family that one diagnostic names: which, how many, and how spelled, and
 * the error that refuses a negative one.
 */

import {
  IS_VALID_INT_RE,
  stringToInt,
  visitIndexedKeys,
  type IndexParse,
} from '../godot/index.js';
import type { ParseError } from './types.js';
import { keyShapeError } from './validators/propertyError.js';

/**
 * A `*_count` has no ceiling, so one diagnostic per index can exceed the spread argument limit and
 * throw away the whole lint, and one joined message can be megabytes wide.
 */
const MAX_REPORTED_INDICES = 32;

/**
 * `0, 1, 2 and 9,997 more`: the indices a message names, capped. `total` is for a
 * caller whose `indices` is already the capped prefix.
 */
export function listIndices(indices: readonly (number | string)[], total = indices.length): string {
  const shown = indices.slice(0, MAX_REPORTED_INDICES);
  const rest = total - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest.toLocaleString('en-US')} more` : shown.join(', ');
}

/**
 * What a written index text resolves to: one number, or one per index position of a nested key
 * (`settings/0/joints/5` resolves to `[0, 5]`).
 */
export type ResolvedIndex = number | readonly number[];

const positionsOf = (resolved: ResolvedIndex): readonly number[] =>
  typeof resolved === 'number' ? [resolved] : resolved;

/** Whether `text` spells `stored`: `+5` and `05` spell 5, and `4294967297` does not spell 1. */
function spells(text: string, stored: number): boolean {
  return IS_VALID_INT_RE.test(text) && BigInt(text) === BigInt(stored);
}

/**
 * An index as a message names it: the text the key writes, then what Godot stores where the two
 * differ. `to_int()` lands in an `int`, so `4294967297` is stored as 1 and `x1` as 1. A nested key
 * (`0/5`) is compared position by position.
 */
export function writtenIndex(text: string, stored: ResolvedIndex): string {
  const positions = positionsOf(stored);
  const parts = text.split('/');
  const isPlain =
    parts.length === positions.length && parts.every((part, at) => spells(part, positions[at]!));
  return isPlain ? text : `${text} (stored as ${positions.join('/')})`;
}

/**
 * The key-shape error for an index text that `to_int()` stores below zero, or null. The index is
 * read into an `int`, so `a-1` is -1 (ustring.cpp:2291-2292) and `2147483648` wraps to -2147483648.
 * `message` receives the index as {@link writtenIndex} spells it.
 */
export function negativeIndexError(
  indexText: string,
  key: string,
  line: number,
  message: (index: string) => string,
  code: string
): ParseError | null {
  const index = stringToInt(indexText);
  if (index < 0) return keyShapeError(key, line, message(writtenIndex(indexText, index)), code);
  return null;
}

/**
 * Ascending position by position. A plain number allocates nothing, since the selection below
 * compares every entry at least once.
 */
function compareResolved(a: ResolvedIndex, b: ResolvedIndex): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const positionsA = positionsOf(a);
  const positionsB = positionsOf(b);
  for (let at = 0; at < Math.min(positionsA.length, positionsB.length); at++) {
    if (positionsA[at] !== positionsB[at]) return positionsA[at]! - positionsB[at]!;
  }
  return 0;
}

/** One written index text and what it resolves to, as a map entry holds them. */
type WrittenEntry = readonly [string, ResolvedIndex];

function byResolvedIndex([textA, resolvedA]: WrittenEntry, [textB, resolvedB]: WrittenEntry): number {
  // Several spellings can resolve alike (`5`, `+5`, `05` and `4294967301`), so the text breaks the
  // tie, shorter first, which orders plain digit runs by value.
  return (
    compareResolved(resolvedA, resolvedB) ||
    textA.length - textB.length ||
    (textA < textB ? -1 : textA > textB ? 1 : 0)
  );
}

/** Where `entry` goes in the ascending `entries`: after every entry it does not precede. */
function insertionPoint(entries: readonly WrittenEntry[], entry: WrittenEntry): number {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (byResolvedIndex(entry, entries[middle]!) < 0) high = middle;
    else low = middle + 1;
  }
  return low;
}

/**
 * The {@link MAX_REPORTED_INDICES} entries a sort by {@link byResolvedIndex} puts first, in that
 * order, from one pass: a family can write 200,000 keys past its count, and a full sort orders all
 * of them to show 32. A later entry that ties goes after, where a stable sort puts it.
 */
function firstWritten(written: Iterable<WrittenEntry>): WrittenEntry[] {
  const first: WrittenEntry[] = [];
  for (const entry of written) {
    const isFull = first.length === MAX_REPORTED_INDICES;
    if (isFull && byResolvedIndex(entry, first[first.length - 1]!) >= 0) continue;
    first.splice(insertionPoint(first, entry), 0, entry);
    if (first.length > MAX_REPORTED_INDICES) first.pop();
  }
  return first;
}

/**
 * The index texts a message names, each as {@link writtenIndex} spells it, ascending by what each
 * resolves to and capped like {@link listIndices}. Never `Number(text)`: past 2^53 a double no
 * longer holds the integer the file states, and `Number` reads `9999999999999999999999` as `1e+22`.
 * One depth per map: `5` beside `[5, 0]` has no order, as neither position list outranks the other.
 */
export function listWrittenIndices(
  written: ReadonlyMap<string, number> | ReadonlyMap<string, readonly [number, number]>
): string {
  // Capped before it is spelled: each `writtenIndex` parses its text twice as a BigInt.
  const shown = firstWritten(written).map(([text, resolved]) => writtenIndex(text, resolved));
  return listIndices(shown, written.size);
}

/**
 * Each index text a family's keys write at or past `count`, mapped to the index it resolves to:
 * the writes an array of that length drops. `visitIndexedKeys` visits no negative index, which is
 * the family dispatcher's report in phase 1, so one refusal is reported once.
 */
export function indicesPastCount(
  properties: Readonly<Record<string, string>>,
  prefix: string,
  indexParse: IndexParse,
  count: number
): Map<string, number> {
  const past = new Map<string, number>();
  visitIndexedKeys(properties, prefix, indexParse, (_key, indexText, index) => {
    if (index >= count) past.set(indexText, index);
  });
  return past;
}

/**
 * The indices of `0..count` that `satisfied` does not hold, capped, and their
 * total, which is `count` minus the satisfied ones, so the walk stops at the cap
 * even for a legal `2147483647`. `satisfied` must hold only indices in `0..count`.
 */
export function unsatisfiedIndices(
  count: number,
  satisfied: ReadonlySet<number>
): { listed: number[]; total: number } {
  const listed: number[] = [];
  for (let index = 0; index < count && listed.length < MAX_REPORTED_INDICES; index++) {
    if (!satisfied.has(index)) listed.push(index);
  }
  // Clamped: a negative `count` allocates nothing in the engine, and its own
  // validator reports it.
  return { listed, total: Math.max(0, count - satisfied.size) };
}
