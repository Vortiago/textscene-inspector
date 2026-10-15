/**
 * Finds the `PROPERTY_HINT_RESOURCE_TYPE` hint that excludes a class on a slot, through the class's
 * base chain, from the generated exclusion table and the hand rows of a class the pin lacks.
 */

import { findInClassChain } from './classBaseTypes.js';
import { PROPERTY_HINT } from './propertyHint.js';
import { resourceTypeHint } from './resourceTypeHint.js';
import { RESOURCE_TYPE_EXCLUSIONS } from './resourceTypeExclusions.generated.js';
import { UNCATALOGUED_PROPERTIES } from './uncataloguedProperties.js';

/** A resource slot's hint that excludes a class, with the class that declares the slot. */
interface ExcludingHint {
  readonly declaredBy: string;
  readonly hintString: string;
  readonly excluded: readonly string[];
}

/**
 * The resource hint of the slot `className` declares itself under `property`, `''` for a
 * declaration under another hint, or undefined when the class does not declare it.
 * `Object.hasOwn`, as the `.tscn` chooses both names.
 */
function ownHintString(className: string, property: string): string | undefined {
  if (Object.hasOwn(RESOURCE_TYPE_EXCLUSIONS, className)) {
    const slots = RESOURCE_TYPE_EXCLUSIONS[className]!;
    return Object.hasOwn(slots, property) ? slots[property] : undefined;
  }
  if (!Object.hasOwn(UNCATALOGUED_PROPERTIES, className)) return undefined;
  const row = UNCATALOGUED_PROPERTIES[className]!.find(([name]) => name === property);
  if (!row) return undefined;
  return row[2] === PROPERTY_HINT.RESOURCE_TYPE ? row[3] : '';
}

/**
 * The hint of `className`'s `property` when its nearest declaration excludes a class, from the
 * class itself or an ancestor. Undefined for any other property.
 */
export function excludingHint(className: string, property: string): ExcludingHint | undefined {
  // `null` ends the walk: the nearest declaration excludes nothing.
  const found = findInClassChain(className, (declaredBy): ExcludingHint | null | undefined => {
    const hintString = ownHintString(declaredBy, property);
    if (hintString === undefined) return undefined;
    const { excluded } = resourceTypeHint(hintString);
    return excluded.length > 0 ? { declaredBy, hintString, excluded } : null;
  });
  return found ?? undefined;
}
