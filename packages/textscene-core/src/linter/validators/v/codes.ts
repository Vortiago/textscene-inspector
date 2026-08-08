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

/** `float 0-1` / `float >= 0` / `integer 1-256` / `float`, from the bounds. */
export function numericRange(kind: 'float' | 'integer', min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${kind} ${min}-${max}`;
  if (min !== undefined) return `${kind} >= ${min}`;
  if (max !== undefined) return `${kind} <= ${max}`;
  return kind;
}
