import { classInheritanceChain, findInClassChain } from './classBaseTypes.js';
import {
  NODE_CLASS_PROPERTIES,
  RESOURCE_CLASS_PROPERTIES,
  SETTERLESS_PROPERTIES,
  type ClassPropertyRow,
} from './classProperties.generated.js';
import { UNCATALOGUED_PROPERTIES } from './uncataloguedProperties.js';

export interface ClassProperty {
  readonly name: string;
  /** variant.h:96-145 */
  readonly type: number;
  /** object.h:50-96 */
  readonly hint: number;
  readonly hintString: string;
  readonly declaredBy: string;
  /** Only where it differs from `type`; the loader converts to it (binder_common.h:175). */
  readonly setterType?: number;
  /** The loader drops the write (class_db.cpp:1655-1659). */
  readonly isSetterless?: true;
}

const PROPERTY_TABLES = [NODE_CLASS_PROPERTIES, RESOURCE_CLASS_PROPERTIES, UNCATALOGUED_PROPERTIES];

/** Written only by {@link ownProperties}; never cleared. */
const ownPropertyIndex = new Map<string, ReadonlyMap<string, ClassProperty>>();

function ownRows(className: string): readonly ClassPropertyRow[] | undefined {
  for (const table of PROPERTY_TABLES) {
    if (Object.hasOwn(table, className)) return table[className];
  }
  return undefined;
}

function toClassProperty(
  [name, type, hint, hintString, setterType]: ClassPropertyRow,
  declaredBy: string,
  setterless: readonly string[]
): ClassProperty {
  return {
    name,
    type,
    hint,
    hintString,
    declaredBy,
    ...(setterType === undefined ? {} : { setterType }),
    ...(setterless.includes(name) ? { isSetterless: true as const } : {}),
  };
}

export function valueTypeOf(property: ClassProperty): number {
  return property.setterType ?? property.type;
}

// A Map, not a row scan: the linter asks for every key of every section.
function ownProperties(className: string): ReadonlyMap<string, ClassProperty> | undefined {
  const indexed = ownPropertyIndex.get(className);
  if (indexed) return indexed;
  const rows = ownRows(className);
  if (!rows) return undefined;
  const setterless = SETTERLESS_PROPERTIES[className] ?? [];
  const byName = new Map(rows.map((row) => [row[0], toClassProperty(row, className, setterless)]));
  ownPropertyIndex.set(className, byName);
  return byName;
}

/** Nearest declaration first; a name declared twice keeps the nearest, as `_set` does. */
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

export function findClassProperty(className: string, name: string): ClassProperty | undefined {
  return findInClassChain(className, (type) => ownProperties(type)?.get(name));
}

/** Rows from a later release's source, not the capture. */
export function isUncatalogued(className: string): boolean {
  return Object.hasOwn(UNCATALOGUED_PROPERTIES, className);
}
