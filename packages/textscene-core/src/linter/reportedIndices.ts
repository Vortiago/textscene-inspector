/**
 * How many indices of an indexed family one diagnostic names.
 *
 * A `*_count` property carries no ceiling — Godot allocates whatever the file
 * declares — so a rule walking `0..count` walks whatever is written, and two
 * shapes broke on that. `SplineIK3D` with `setting_count = 130000` produced one
 * `Diagnostic` per index, and spreading that into the result array exceeded the
 * argument limit: the lint threw and the file returned NO diagnostics at all,
 * parse errors included. `TwoBoneIK3D` joined every index into one message and
 * built a string tens of megabytes wide. Naming the first few indices and the
 * remaining count says the same thing to an author.
 */
const MAX_REPORTED_INDICES = 32;

/**
 * `0, 1, 2 and 9,997 more` — the indices a message names, capped.
 *
 * `total` is for a caller whose `indices` is already the capped prefix, so the
 * remainder cannot be read off its length.
 */
export function listIndices(indices: readonly number[], total = indices.length): string {
  const shown = indices.slice(0, MAX_REPORTED_INDICES);
  const rest = total - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest.toLocaleString('en-US')} more` : shown.join(', ');
}

/**
 * The indices of `0..count` that `satisfied` does NOT hold, capped for listing,
 * beside how many there are in total.
 *
 * The cap above bounds the OUTPUT; this bounds the WALK, which is the other half
 * of the same fact. `setting_count` is an INT slot with no ceiling, so
 * `2147483647` really is a legal value a validator passes, and a rule that
 * builds one template string per index spends minutes and gigabytes reaching a
 * message it then truncates to 32 entries. The total needs no walk: every index
 * the file does not name is unsatisfied by definition, so `count` minus the
 * satisfied ones is it, and the listing loop stops at the cap.
 *
 * `satisfied` must already be restricted to `0..count`.
 */
export function unsatisfiedIndices(
  count: number,
  satisfied: ReadonlySet<number>
): { listed: number[]; total: number } {
  const listed: number[] = [];
  for (let index = 0; index < count && listed.length < MAX_REPORTED_INDICES; index++) {
    if (!satisfied.has(index)) listed.push(index);
  }
  // Clamped, so a negative `count` — which its own validator reports and which
  // allocates nothing in the engine — names no unsatisfied index here either.
  return { listed, total: Math.max(0, count - satisfied.size) };
}
