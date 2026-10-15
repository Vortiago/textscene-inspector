/**
 * Merge the parts of a keyed table, refusing a key two parts both declare.
 *
 * A plain spread keeps the last part's entry and drops the earlier one in
 * silence, and every guard downstream still passes. A key belongs to exactly
 * one part, so the throw names a collision at import time.
 *
 * @param what - what the parts hold, for the error message ('census rows').
 */
export function mergeDisjoint<T>(
  parts: readonly Readonly<Record<string, T>>[],
  what: string
): Readonly<Record<string, T>> {
  // A null prototype: on a `{}`, a Godot name that lives on `Object.prototype`
  // reads as already declared, and `__proto__` assigns through the setter and
  // lands as no own key, dropped without a duplicate report. The membership test
  // and every consumer's bare-index read then see only the merged keys.
  const merged: Record<string, T> = Object.create(null) as Record<string, T>;
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (Object.hasOwn(merged, key)) throw new Error(`${key} has ${what} in two parts`);
      merged[key] = value;
    }
  }
  return merged;
}
