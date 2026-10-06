/**
 * Resolves a class's serialised properties through the same base chain Godot's
 * `_get_property_list` walks, so hover and completion name a property on the class that
 * declares it. The rows come from the committed ClassDB captures. The chain comes from
 * the generated base-type tables, never by hand.
 */

import { classBaseChain } from '../godot/classBaseTypes.js';
import { NODE_BASE_TYPES, isCatalogedType } from '../godot/nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from '../godot/resourceBaseTypes.generated.js';
import {
  NODE_CLASS_PROPERTIES,
  RESOURCE_CLASS_PROPERTIES,
  type ClassPropertyRow,
} from '../godot/classProperties.generated.js';
import type { PropertyLocation } from './document.js';

/** One serialised property, with the class nearest the queried type that declares it. */
export interface ClassProperty {
  readonly name: string;
  /** `Variant::Type` (`variant.h:96-145`). */
  readonly type: number;
  /** `PropertyHint` (`object.h:50-96`). */
  readonly hint: number;
  readonly hintString: string;
  readonly declaredBy: string;
}

function ownRows(className: string): readonly ClassPropertyRow[] | undefined {
  if (Object.hasOwn(NODE_CLASS_PROPERTIES, className)) return NODE_CLASS_PROPERTIES[className];
  if (Object.hasOwn(RESOURCE_CLASS_PROPERTIES, className)) return RESOURCE_CLASS_PROPERTIES[className];
  return undefined;
}

/** The class itself, then each ancestor, nearest first. */
function selfAndAncestors(className: string): readonly string[] {
  return [className, ...classBaseChain(className)];
}

function toClassProperty(
  [name, type, hint, hintString]: ClassPropertyRow,
  declaredBy: string
): ClassProperty {
  return { name, type, hint, hintString, declaredBy };
}

/**
 * Every property a class serialises, its own and its ancestors', nearest declaration
 * first. A name declared twice keeps the nearest class, as `_set` resolves it.
 */
export function classProperties(className: string): readonly ClassProperty[] {
  const properties: ClassProperty[] = [];
  const seen = new Set<string>();
  for (const declaredBy of selfAndAncestors(className)) {
    for (const row of ownRows(declaredBy) ?? []) {
      const name = row[0];
      if (seen.has(name)) continue;
      seen.add(name);
      properties.push(toClassProperty(row, declaredBy));
    }
  }
  return properties;
}

/** The property `className` serialises under `name`, or undefined when it has none. */
export function findClassProperty(className: string, name: string): ClassProperty | undefined {
  for (const declaredBy of selfAndAncestors(className)) {
    const row = ownRows(declaredBy)?.find(([rowName]) => rowName === name);
    if (row) return toClassProperty(row, declaredBy);
  }
  return undefined;
}

/** The property a slot fills, found by the key the engine stores it under, or undefined. */
export function slotProperty({ section, property }: PropertyLocation): ClassProperty | undefined {
  return section.ownerType ? findClassProperty(section.ownerType, property.storedKey) : undefined;
}

/** Whether Godot's ClassDB knows the class as a node or a resource. */
export function isKnownClass(className: string): boolean {
  return (
    isCatalogedType(className) ||
    className === 'Resource' ||
    Object.hasOwn(RESOURCE_BASE_TYPES_GENERATED, className)
  );
}

/** A base-type table's classes and its terminal class, which has no entry, sorted. */
function classNamesOf(baseTypes: Readonly<Record<string, string>>, terminal: string): readonly string[] {
  return [...new Set([...Object.keys(baseTypes), terminal])].sort((a, b) => a.localeCompare(b));
}

/**
 * Every node class a scene may name, `Node` included. The table holds a class per
 * ancestry hop, so abstract bases such as `GeometryInstance3D` are offered too: a scene
 * names them as readily as a leaf, and the engine instantiates them.
 */
export function nodeClassNames(): readonly string[] {
  return classNamesOf(NODE_BASE_TYPES, 'Node');
}

/** Every Resource class a `[sub_resource type="…"]` may name. */
export function resourceClassNames(): readonly string[] {
  return classNamesOf(RESOURCE_BASE_TYPES_GENERATED, 'Resource');
}
