/** The member names of a numeric TypeScript enum, keyed by the integer Godot stores. */

/**
 * Each member name by its integer, as a validator or an inspector names it. The numeric members
 * only: a TS enum object also maps each name back to its integer.
 */
export function enumNamesByValue(enumObject: object): Readonly<Record<number, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(enumObject)
        .filter(([, value]) => typeof value === 'number')
        .map(([name, value]) => [value, name])
    )
  );
}
