/**
 * The strings a combinator derives instead of taking from its caller: the error
 * codes every branch reports under, and the phrase that names a numeric range
 * in the generated `## Linting` table.
 */

/**
 * Convert `cast_shadow` → `CAST_SHADOW`. Used to auto-derive error
 * codes so call sites don't pass them.
 */
export function upper(name: string): string {
  return name.toUpperCase();
}

/** Auto-derived error codes for the "must be a number" branch. */
export function formatCode(name: string, kind = 'FORMAT'): string {
  return `INVALID_${upper(name)}_${kind}`;
}

/** Auto-derived error codes for the "out of range" branch. */
export function valueCode(name: string): string {
  return formatCode(name, 'VALUE');
}

/**
 * `float 0-1` / `float >= 0` / `integer 1-256` / `float`, from the bounds.
 *
 * A setter end outside the hint's is named first and the hint's follows in
 * parentheses, because the two report at different tiers and a reader of the
 * sheet needs to know which number is refused and which merely warns.
 */
export function numericRange(
  kind: 'float' | 'integer',
  min?: number,
  max?: number,
  ends: {
    enforcedMin?: { at: number; exclusive?: boolean };
    enforcedMax?: { at: number; exclusive?: boolean };
  } = {}
): string {
  const hinted =
    min !== undefined && max !== undefined
      ? `${min}-${max}`
      : min !== undefined
        ? `>= ${min}`
        : max !== undefined
          ? `<= ${max}`
          : '';
  if (hinted) return `${kind} ${hinted}`;
  // Only where the end has no outer bound of its own. Where it has both, the
  // outer one IS the clean domain and the setter's is further out, so naming
  // both here says the accepted range is wider than it is. The severity of each
  // end belongs in the sheet's "Out of range" column, not in this one.
  const { enforcedMin, enforcedMax } = ends;
  const refused = [
    enforcedMin && `${enforcedMin.exclusive ? '>' : '>='} ${enforcedMin.at}`,
    enforcedMax && `${enforcedMax.exclusive ? '<' : '<='} ${enforcedMax.at}`,
  ]
    .filter(Boolean)
    .join(', ');
  return refused ? `${kind} ${refused}` : kind;
}
