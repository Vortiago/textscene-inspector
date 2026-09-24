/**
 * How many indices of an indexed family one diagnostic names. A `*_count` has
 * no ceiling, so one diagnostic per index can exceed the spread argument limit
 * and throw away the whole lint, and one joined message can be megabytes wide.
 */
const MAX_REPORTED_INDICES = 32;

/**
 * `0, 1, 2 and 9,997 more`: the indices a message names, capped. `total` is for a
 * caller whose `indices` is already the capped prefix.
 */
export function listIndices(indices: readonly number[], total = indices.length): string {
  const shown = indices.slice(0, MAX_REPORTED_INDICES);
  const rest = total - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest.toLocaleString('en-US')} more` : shown.join(', ');
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
