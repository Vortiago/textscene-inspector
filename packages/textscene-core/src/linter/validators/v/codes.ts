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
 * one spelling of that template. `kind` names a branch of its own, such as a
 * reference that is not a `SubResource(…)`.
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

/**
 * The tighter of two ends at the same side, `exclusive` breaking a tie. Unlike
 * `outerEndIsReachable` (grounding.ts), which asks only whether a band is
 * non-empty, this is where the endpoint decides.
 */
function tighter(hint: RangeEnd | undefined, setter: RangeEnd | undefined, end: 'min' | 'max') {
  if (!hint) return setter;
  if (!setter) return hint;
  const setterIsInside = end === 'min' ? setter.at > hint.at : setter.at < hint.at;
  const coincidesButExcludes = setter.at === hint.at && setter.exclusive;
  return setterIsInside || coincidesButExcludes ? setter : hint;
}

/**
 * `float 0-1` / `float >= 0` / `integer 1-256` / `float`, from the bounds. Built
 * per end, taking the tighter tier at each side, since this column is the domain
 * that reports nothing. The tier each end reports at belongs in the sheet's
 * "Out of range" column.
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
  // Two inclusive ends keep the compact `0-1` spelling, which the messages in
  // integers.ts and vectors.ts interpolate.
  if (lo && hi && !lo.exclusive && !hi.exclusive) return `${kind} ${lo.at}-${hi.at}`;
  return `${kind} ${[
    lo && `${lo.exclusive ? '>' : '>='} ${lo.at}`,
    hi && `${hi.exclusive ? '<' : '<='} ${hi.at}`,
  ]
    .filter(Boolean)
    .join(', ')}`;
}
