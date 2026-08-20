/**
 * Merge the parts of a keyed table, refusing a key two parts both declare.
 *
 * The baked tables the conformance guards read — the configuration-warning
 * census, the parser/linter asymmetry allowlist — are large enough to be kept
 * one family per file, and a plain spread would then keep the LAST part's entry
 * and drop the earlier one in silence. Every guard downstream would still pass:
 * they check the entries that are there, not the ones that ought to be. A key
 * belongs to exactly one part, so a collision is a mistake whichever part is
 * right, and the throw names it at import time.
 *
 * @param what - what the parts hold, for the error message ('census rows').
 */
export function mergeDisjoint<T>(
  parts: readonly Readonly<Record<string, T>>[],
  what: string
): Readonly<Record<string, T>> {
  const merged: Record<string, T> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      // `Object.hasOwn`, not `in`: the two sides must be the same set. Both
      // keys come from a table keyed by a Godot name, and `in` walks the
      // prototype, so `toString`/`valueOf`/`constructor` collided with
      // `Object.prototype` on their FIRST and only declaration and threw at
      // import time, taking the linter barrel down with them.
      if (Object.hasOwn(merged, key)) throw new Error(`${key} has ${what} in two parts`);
      merged[key] = value;
    }
  }
  return merged;
}
