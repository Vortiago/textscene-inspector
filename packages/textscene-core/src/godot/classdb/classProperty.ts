/**
 * A class's serialised properties, resolved through the same base chain Godot's
 * `_get_property_list` walks, so a reader finds a property on the class that declares it. The rows
 * come from the committed ClassDB captures, and from the hand rows of a class the pinned build
 * lacks. Hover, completion and the linter's property descriptor all read this one walk.
 */

import { classInheritanceChain, findInClassChain } from './classBaseTypes.js';
import {
  NODE_CLASS_PROPERTIES,
  RESOURCE_CLASS_PROPERTIES,
  type ClassPropertyRow,
} from './classProperties.generated.js';
import { UNCATALOGUED_PROPERTIES } from './uncataloguedProperties.js';

/** One serialised property, with the class nearest the queried type that declares it. */
export interface ClassProperty {
  readonly name: string;
  /** `Variant::Type` (`variant.h:96-145`). */
  readonly type: number;
  /** `PropertyHint` (`object.h:50-96`). */
  readonly hint: number;
  readonly hintString: string;
  readonly declaredBy: string;
  /**
   * The `Variant::Type` of the setter's value argument, present only where it differs from
   * `type`. The loader converts a value to it (`class_db.cpp:1677`, `binder_common.h:175`).
   */
  readonly setterType?: number;
}

const PROPERTY_TABLES = [NODE_CLASS_PROPERTIES, RESOURCE_CLASS_PROPERTIES, UNCATALOGUED_PROPERTIES];

/**
 * Each class's own properties by name, built on the first lookup of that class. Written only by
 * {@link ownProperties}, and never cleared: the tables it indexes are frozen.
 */
const ownPropertyIndex = new Map<string, ReadonlyMap<string, ClassProperty>>();

function ownRows(className: string): readonly ClassPropertyRow[] | undefined {
  for (const table of PROPERTY_TABLES) {
    if (Object.hasOwn(table, className)) return table[className];
  }
  return undefined;
}

function toClassProperty(
  [name, type, hint, hintString, setterType]: ClassPropertyRow,
  declaredBy: string
): ClassProperty {
  return { name, type, hint, hintString, declaredBy, ...(setterType === undefined ? {} : { setterType }) };
}

/** The type a value converts to on load: the setter's, else the property's own. */
export function valueTypeOf(property: ClassProperty): number {
  return property.setterType ?? property.type;
}

/**
 * The properties `className` declares itself, by name. A Map, not a scan of the rows: the
 * linter asks this for every key of every section, so a lookup allocates nothing after the first.
 */
function ownProperties(className: string): ReadonlyMap<string, ClassProperty> | undefined {
  const indexed = ownPropertyIndex.get(className);
  if (indexed) return indexed;
  const rows = ownRows(className);
  if (!rows) return undefined;
  const byName = new Map(rows.map((row) => [row[0], toClassProperty(row, className)]));
  ownPropertyIndex.set(className, byName);
  return byName;
}

/**
 * Every property a class serialises, its own and its ancestors', nearest declaration
 * first. A name declared twice keeps the nearest class, as `_set` resolves it.
 */
export function classProperties(className: string): readonly ClassProperty[] {
  const properties: ClassProperty[] = [];
  const seen = new Set<string>();
  for (const declaredBy of classInheritanceChain(className)) {
    for (const property of ownProperties(declaredBy)?.values() ?? []) {
      if (seen.has(property.name)) continue;
      seen.add(property.name);
      properties.push(property);
    }
  }
  return properties;
}

/** The property `className` serialises under `name`, or undefined when it has none. */
export function findClassProperty(className: string, name: string): ClassProperty | undefined {
  return findInClassChain(className, (type) => ownProperties(type)?.get(name));
}

/** Whether the class's rows come from the source of a later release, not from the capture. */
export function isUncatalogued(className: string): boolean {
  return Object.hasOwn(UNCATALOGUED_PROPERTIES, className);
}
