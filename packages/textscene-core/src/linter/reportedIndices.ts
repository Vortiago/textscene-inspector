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

/** `0, 1, 2 and 9,997 more` — the indices a message names, capped. */
export function listIndices(indices: readonly number[]): string {
  const shown = indices.slice(0, MAX_REPORTED_INDICES).join(', ');
  const rest = indices.length - MAX_REPORTED_INDICES;
  return rest > 0 ? `${shown} and ${rest.toLocaleString('en-US')} more` : shown;
}

/** The prefix of `indices` a rule may raise one diagnostic each for. */
export function cappedIndices(indices: readonly number[]): readonly number[] {
  return indices.slice(0, MAX_REPORTED_INDICES);
}

/** How many of `indices` `cappedIndices` left out, for the last diagnostic to name. */
export function omittedIndexCount(indices: readonly number[]): number {
  return Math.max(0, indices.length - MAX_REPORTED_INDICES);
}
