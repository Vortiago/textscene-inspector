/**
 * Reads a property's `hint` and `hint_string` into what an editor can show: the
 * labels of an enum, the base class of a resource slot, or the bounds of a range.
 * The numbers are `PropertyHint` (`object.h:50-96`) and the strings are Godot's own
 * serialisations, so nothing here invents a value the inspector would not offer.
 */

import { PROPERTY_HINT } from '../godot/propertyHint.js';

/** One `PROPERTY_HINT_ENUM` label, with the integer the engine stores for it. */
export interface EnumEntry {
  readonly label: string;
  /** The integer literal to write. An explicit `Label:3` uses 3, else the label's index. */
  readonly value: string;
}

/** Whether the hint offers a fixed set of integer labels. Flags are a bitmask, so excluded. */
export function isEnumHint(hint: number): boolean {
  return hint === PROPERTY_HINT.ENUM || hint === PROPERTY_HINT.ENUM_SUGGESTION;
}

/**
 * The labels of an enum hint, in order. An empty hint string is a hint of unknown
 * labels, so it yields nothing rather than one empty label. A label's `:value`
 * suffix overrides the index, as `PropertyHint`'s own syntax states.
 */
export function enumEntries(hintString: string): readonly EnumEntry[] {
  if (hintString.length === 0) return [];
  return hintString.split(',').map((raw, index) => {
    const colon = raw.indexOf(':');
    if (colon === -1) return { label: raw, value: String(index) };
    const value = raw.slice(colon + 1);
    return { label: raw.slice(0, colon), value: value.length > 0 ? value : String(index) };
  });
}

/** The labels of a flags hint, whose value is a bitmask rather than one choice. */
export function flagLabels(hint: number, hintString: string): readonly string[] | undefined {
  if (hint !== PROPERTY_HINT.FLAGS || hintString.length === 0) return undefined;
  return hintString.split(',');
}

/** Whether the hint names the resource classes a slot accepts (`PROPERTY_HINT_RESOURCE_TYPE`). */
export function resourceTypeHint(hint: number, hintString: string): readonly string[] | undefined {
  if (hint !== PROPERTY_HINT.RESOURCE_TYPE || hintString.length === 0) return undefined;
  return hintString
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('-'));
}

/** A bounds hint, split into its parts. `or_greater` or `or_less` leaves an end open. */
export interface RangeHint {
  readonly min: string;
  readonly max: string;
  readonly hasMin: boolean;
  readonly hasMax: boolean;
}

/** The numeric bounds of a `PROPERTY_HINT_RANGE`, or undefined for another hint. */
export function rangeHint(hint: number, hintString: string): RangeHint | undefined {
  if (hint !== PROPERTY_HINT.RANGE) return undefined;
  const parts = hintString.split(',');
  const min = (parts[0] ?? '').trim();
  const max = (parts[1] ?? '').trim();
  const greater = parts.some((part) => part.trim() === 'or_greater');
  const less = parts.some((part) => part.trim() === 'or_less');
  return {
    min,
    max,
    hasMin: min.length > 0 && !less,
    hasMax: max.length > 0 && !greater,
  };
}

/** The suffix a range hint appends to its unit, such as `dB` or `px`, when it names one. */
export function rangeSuffix(hint: number, hintString: string): string | undefined {
  if (hint !== PROPERTY_HINT.RANGE) return undefined;
  for (const part of hintString.split(',')) {
    const trimmed = part.trim();
    if (trimmed.startsWith('suffix:')) return trimmed.slice('suffix:'.length);
  }
  return undefined;
}
