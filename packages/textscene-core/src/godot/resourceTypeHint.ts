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

/** The resource hints `className` declares itself, generated and hand rows alike. */
function ownResourceHints(className: string): readonly (readonly [property: string, hintString: string])[] {
  if (Object.hasOwn(RESOURCE_TYPE_EXCLUSIONS, className)) {
    return Object.entries(RESOURCE_TYPE_EXCLUSIONS[className]!);
  }
  if (!Object.hasOwn(UNCATALOGUED_PROPERTIES, className)) return [];
  return UNCATALOGUED_PROPERTIES[className]!.filter(([, , hint]) => hint === PROPERTY_HINT.RESOURCE_TYPE).map(
    ([property, , , hintString]) => [property, hintString] as const
  );
}

/** Written only by `excludingSlots`, once per class name. Never cleared: the tables are constant. */
const excludingSlotsByClass = new Map<string, ReadonlyMap<string, ExcludingHint>>();

/** Every slot of `className` whose nearest declaration excludes a class, keyed by property. */
function excludingSlots(className: string): ReadonlyMap<string, ExcludingHint> {
  const cached = excludingSlotsByClass.get(className);
  if (cached) return cached;
  const slots = new Map<string, ExcludingHint>();
  const declared = new Set<string>();
  for (const declaredBy of [className, ...classBaseChain(className)]) {
    for (const [property, hintString] of ownResourceHints(declaredBy)) {
      if (declared.has(property)) continue;
      declared.add(property);
      const { excluded } = resourceTypeHint(hintString);
      if (excluded.length > 0) slots.set(property, { declaredBy, hintString, excluded });
    }
  }
  excludingSlotsByClass.set(className, slots);
  return slots;
}

/**
 * The hint of `className`'s `property` when it excludes a class, from the class itself or the
 * nearest ancestor that declares it. Undefined for any other property.
 */
export function excludingHint(className: string, property: string): ExcludingHint | undefined {
  return excludingSlots(className).get(property);
}
