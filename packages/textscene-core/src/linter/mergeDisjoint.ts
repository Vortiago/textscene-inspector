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
  // A null prototype, so the accumulator carries only what was merged into it:
  // the keys are Godot names, and on a `{}` a name that also lives on
  // `Object.prototype` reads as already-declared, while `__proto__` assigns
  // through the setter and lands as no own key at all — silently dropped and
  // never reported as a duplicate. The membership test below is then the same
  // set as the `Object.entries` it is compared against, and so is every
  // consumer's bare-index read of the table.
  const merged: Record<string, T> = Object.create(null) as Record<string, T>;
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (Object.hasOwn(merged, key)) throw new Error(`${key} has ${what} in two parts`);
      merged[key] = value;
    }
  }
  return merged;
}
