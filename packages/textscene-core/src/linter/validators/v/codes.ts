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
 * The hint's ends wherever it states any; the setter's own only at an end where
 * no hint end exists. Never both — see the body for why naming both would
 * overstate the accepted range. The tier each end reports at belongs in the
 * sheet's "Out of range" column, not here.
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
