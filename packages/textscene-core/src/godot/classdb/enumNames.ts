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

/**
 * Each member's label by its integer, for a hint that spells the names with no rule to derive
 * them from. `labels` must name every member, so a member added to the enum fails the type check.
 */
/* @__NO_SIDE_EFFECTS__ */
export function labelEnumNames<T extends Record<string, number>>(
  enumObject: T,
  labels: Readonly<Record<keyof T, string>>
): Readonly<Record<number, string>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(enumObject).map(([name, value]) => [value, labels[name as keyof T]]))
  );
}

/** A `SPECIFIC_BONE` member as the PascalCase word a hint string prints, `SpecificBone`. */
/* @__NO_SIDE_EFFECTS__ */
export function pascalCaseLabel(name: string): string {
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/** Every integer a numeric TypeScript enum holds, in declaration order, without the name-to-integer entries. */
/* @__NO_SIDE_EFFECTS__ */
export function enumValues<T extends number>(enumObject: Record<string, string | T>): readonly T[] {
  return Object.values(enumObject).filter((value): value is T => typeof value === 'number');
}
