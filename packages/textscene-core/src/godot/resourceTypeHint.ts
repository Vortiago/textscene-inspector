/**
 * Reads a `PROPERTY_HINT_RESOURCE_TYPE` hint string the way the editor's resource picker does
 * (`editor_resource_picker.cpp:824-833`): each comma part is stripped, and a part after a `-`
 * names a class the slot excludes (`object.h:68`). The picker erases the exact name, so a
 * subclass of an excluded class stays allowed.
 */

import { classBaseChain } from './classBaseTypes.js';
import { PROPERTY_HINT } from './propertyHint.js';
import { RESOURCE_TYPE_EXCLUSIONS } from './resourceTypeExclusions.generated.js';
import { UNCATALOGUED_PROPERTIES } from './uncataloguedProperties.js';

export interface ResourceTypeHint {
  /** The classes the slot accepts, each with its subclasses. */
  readonly bases: readonly string[];
  /** The exact class names the slot refuses, though a base admits them. */
  readonly excluded: readonly string[];
}

export function resourceTypeHint(hintString: string): ResourceTypeHint {
  const bases: string[] = [];
  const excluded: string[] = [];
  for (const raw of hintString.split(',')) {
    const part = raw.trim();
    if (part.startsWith('-')) excluded.push(part.slice(1));
    else if (part.length > 0) bases.push(part);
  }
  return { bases, excluded };
}

/** A resource slot's hint that excludes a class, with the class that declares the slot. */
export interface ExcludingHint {
  readonly declaredBy: string;
  readonly hintString: string;
  readonly excluded: readonly string[];
}

/** `Object.hasOwn`, as the `.tscn` chooses both names. */
function ownHintString(className: string, property: string): string | undefined {
  if (Object.hasOwn(RESOURCE_TYPE_EXCLUSIONS, className)) {
    const slots = RESOURCE_TYPE_EXCLUSIONS[className]!;
    if (Object.hasOwn(slots, property)) return slots[property];
  }
  if (!Object.hasOwn(UNCATALOGUED_PROPERTIES, className)) return undefined;
  const row = UNCATALOGUED_PROPERTIES[className]!.find(
    ([name, , hint]) => name === property && hint === PROPERTY_HINT.RESOURCE_TYPE
  );
  return row?.[3];
}

/**
 * The hint of `className`'s `property` when it excludes a class, from the class itself or the
 * nearest ancestor that declares it. Undefined for any other property.
 */
export function excludingHint(className: string, property: string): ExcludingHint | undefined {
  for (const declaredBy of [className, ...classBaseChain(className)]) {
    const hintString = ownHintString(declaredBy, property);
    if (hintString === undefined) continue;
    const { excluded } = resourceTypeHint(hintString);
    return excluded.length > 0 ? { declaredBy, hintString, excluded } : undefined;
  }
  return undefined;
}
