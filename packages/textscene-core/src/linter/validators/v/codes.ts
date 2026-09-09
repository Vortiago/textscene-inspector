/**
 * The strings a combinator derives instead of taking from its caller: the error
 * codes every branch reports under, and the phrase that names a numeric range
 * in the generated `## Linting` table.
 */

/** Convert `cast_shadow` → `CAST_SHADOW`, for the codes derived below. */
function upper(name: string): string {
  return name.toUpperCase();
}

/**
 * The code a branch reports under: `INVALID_<NAME>_FORMAT` by default, and the
 * one spelling of that template. `kind` names a branch of its own — a reference
 * that is not a `SubResource(…)`, a path that is not a `NodePath(…)`.
 */
export function formatCode(name: string, kind = 'FORMAT'): string {
  return `INVALID_${upper(name)}_${kind}`;
}

/** Auto-derived error codes for the "out of range" branch. */
export function valueCode(name: string): string {
  return formatCode(name, 'VALUE');
}

/** One end of a numeric domain, from either tier. */
interface RangeEnd {
  at: number;
  exclusive?: boolean;
}

/** The tighter of two ends at the same side, `exclusive` breaking a tie. */
function tighter(hint: RangeEnd | undefined, setter: RangeEnd | undefined, end: 'min' | 'max') {
  if (!hint) return setter;
  if (!setter) return hint;
  const setterIsInside = end === 'min' ? setter.at > hint.at : setter.at < hint.at;
  const coincidesButExcludes = setter.at === hint.at && setter.exclusive;
  return setterIsInside || coincidesButExcludes ? setter : hint;
}

/**
 * `float 0-1` / `float >= 0` / `integer 1-256` / `float`, from the bounds.
 *
 * Built per END, taking the tighter of the two tiers at each side, because this
 * column is the domain that reports NOTHING. Returning on the hint's ends the
 * moment either exists is wrong in two directions at once: a setter ceiling
 * with a hinted floor prints `integer >= 0` and drops the ceiling entirely
 * (`max_contacts_reported`, `bounces`, `max_distance`), and a setter end
 * COINCIDING with the hint's but excluding it printed `float 0-100` for a
 * property whose setter refuses 0 (`aspect_ratio`).
 *
 * `exclusive` is consulted here and NOT in `outerEndIsReachable` (grounding.ts):
 * that one asks whether a band is non-empty, which the endpoint cannot change;
 * this one asks which of two coinciding ends is tighter, which is exactly what
 * the endpoint decides.
 *
 * The tier each end reports at belongs in the sheet's "Out of range" column.
 */
export function numericRange(
  kind: 'float' | 'integer',
  min?: number,
  max?: number,
  ends: {
    enforcedMin?: RangeEnd;
    enforcedMax?: RangeEnd;
  } = {}
): string {
  const lo = tighter(min !== undefined ? { at: min } : undefined, ends.enforcedMin, 'min');
  const hi = tighter(max !== undefined ? { at: max } : undefined, ends.enforcedMax, 'max');
  if (!lo && !hi) return kind;
  // Two inclusive ends keep the compact `0-1` spelling every other row uses —
  // and, with no `ends` at all, keep the user-visible messages that interpolate
  // this (integers.ts, vectors.ts) byte-identical.
  if (lo && hi && !lo.exclusive && !hi.exclusive) return `${kind} ${lo.at}-${hi.at}`;
  return `${kind} ${[
    lo && `${lo.exclusive ? '>' : '>='} ${lo.at}`,
    hi && `${hi.exclusive ? '<' : '<='} ${hi.at}`,
  ]
    .filter(Boolean)
    .join(', ')}`;
}
