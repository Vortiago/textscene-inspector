/** The member names of a numeric TypeScript enum, keyed by the integer Godot stores. */

/**
 * Each member name by its integer, as a validator or an inspector names it. The numeric members
 * only: a TS enum object also maps each name back to its integer.
 */
/* @__NO_SIDE_EFFECTS__ */
export function enumNamesByValue(enumObject: object): Readonly<Record<number, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(enumObject)
        .filter(([, value]) => typeof value === 'number')
        .map(([name, value]) => [value, name])
    )
  );
}

/**
 * Each name in `names` turned by `label`, for a property whose hint prints an enum's names in
 * another form, so the label table still comes from the enum.
 */
/* @__NO_SIDE_EFFECTS__ */
export function relabelEnumNames(
  names: Readonly<Record<number, string>>,
  label: (name: string) => string
): Readonly<Record<number, string>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(names).map(([value, name]) => [value, label(name)]))
  );
}

/** Every integer a numeric TypeScript enum holds, in declaration order, without the name-to-integer entries. */
/* @__NO_SIDE_EFFECTS__ */
export function enumValues<T extends number>(enumObject: Record<string, string | T>): readonly T[] {
  return Object.values(enumObject).filter((value): value is T => typeof value === 'number');
}
