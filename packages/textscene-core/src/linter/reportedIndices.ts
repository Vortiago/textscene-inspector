/** The indices of an indexed family that one diagnostic names: which, how many, and how spelled. */

import { IS_VALID_INT_RE, indexedKeys, type IndexParse } from '../godot/index.js';

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

function byResolvedIndex(
  [textA, resolvedA]: readonly [string, ResolvedIndex],
  [textB, resolvedB]: readonly [string, ResolvedIndex]
): number {
  const a = positionsOf(resolvedA);
  const b = positionsOf(resolvedB);
  for (let at = 0; at < Math.min(a.length, b.length); at++) {
    if (a[at] !== b[at]) return a[at]! - b[at]!;
  }
  // Several spellings can resolve alike (`5`, `+5`, `05` and `4294967301`), so the text breaks the
  // tie, shorter first, which orders plain digit runs by value.
  return textA.length - textB.length || (textA < textB ? -1 : textA > textB ? 1 : 0);
}

/**
 * The index texts a message names, each as {@link writtenIndex} spells it, ascending by what each
 * resolves to and capped like {@link listIndices}. Never `Number(text)`: past 2^53 a double no
 * longer holds the integer the file states, and `Number` reads `9999999999999999999999` as `1e+22`.
 */
export function listWrittenIndices(written: ReadonlyMap<string, ResolvedIndex>): string {
  return listIndices(
    [...written].sort(byResolvedIndex).map(([text, resolved]) => writtenIndex(text, resolved))
  );
}

/**
 * Each index text a family's keys write at or past `count`, mapped to the index it resolves to:
 * the writes an array of that length drops. `indexedKeys` leaves out a negative index, which is
 * the family dispatcher's report in phase 1, so one refusal is reported once.
 */
export function indicesPastCount(
  properties: Readonly<Record<string, string>>,
  prefix: string,
  indexParse: IndexParse,
  count: number
): Map<string, number> {
  const past = new Map<string, number>();
  for (const { indexText, index } of indexedKeys(properties, prefix, indexParse)) {
    if (index >= count) past.set(indexText, index);
  }
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
