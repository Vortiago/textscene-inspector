/** The member names of an enum object, keyed by the integer Godot stores. */

/** The integers an `as const` enum object holds, as the type of a property that stores one. */
export type EnumValue<T extends object> = T[keyof T];

/** Each member name by its integer, as a validator or an inspector names it. */
/* @__NO_SIDE_EFFECTS__ */
export function enumNamesByValue(enumObject: object): Readonly<Record<number, string>> {
  return Object.freeze(Object.fromEntries(Object.entries(enumObject).map(([name, value]) => [value, name])));
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

/**
 * The label of each listed flag by its bit: `prefix` before the member name, as the engine spells
 * the constant. For a bit-field hint that offers only some of the flags of an enum.
 */
/* @__NO_SIDE_EFFECTS__ */
export function flagLabels<T extends Record<string, number>>(
  flags: T,
  prefix: string,
  members: readonly (keyof T & string)[]
): Readonly<Record<number, string>> {
  return Object.freeze(Object.fromEntries(members.map((member) => [flags[member], `${prefix}${member}`])));
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
