/**
 * Resolves a class's serialised properties through the same base chain Godot's
 * `_get_property_list` walks, so hover and completion name a property on the class that
 * declares it. The rows come from the committed ClassDB captures. The chain comes from
 * the generated base-type tables, never by hand.
 */

import { CLASS_BASE_TYPES } from '../godot/classBaseTypes.js';
import { MAX_BASE_CHAIN_HOPS, NODE_BASE_TYPES, isCatalogedType } from '../godot/nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from '../godot/resourceBaseTypes.generated.js';
import {
  NODE_CLASS_PROPERTIES,
  RESOURCE_CLASS_PROPERTIES,
  type ClassPropertyRow,
} from '../godot/classProperties.generated.js';

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

function baseTypeOf(className: string): string | undefined {
  return Object.hasOwn(CLASS_BASE_TYPES, className) ? CLASS_BASE_TYPES[className] : undefined;
}

/** Every ancestor of a class, nearest first, cycle-safe and bounded. */
export function classChain(className: string): readonly string[] {
  const chain: string[] = [];
  const seen = new Set([className]);
  let current = baseTypeOf(className);
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    if (seen.has(current)) break;
    seen.add(current);
    chain.push(current);
    current = baseTypeOf(current);
  }
  return chain;
}

/**
 * Every property a class serialises, its own and its ancestors', nearest declaration
 * first. A name declared twice keeps the nearest class, as `_set` resolves it.
 */
export function classProperties(className: string): readonly ClassProperty[] {
  const properties: ClassProperty[] = [];
  const seen = new Set<string>();
  for (const cls of [className, ...classChain(className)]) {
    const rows = ownRows(cls);
    if (!rows) continue;
    for (const [name, type, hint, hintString] of rows) {
      if (seen.has(name)) continue;
      seen.add(name);
      properties.push({ name, type, hint, hintString, declaredBy: cls });
    }
  }
  return properties;
}

/** The property `className` serialises under `name`, or undefined when it has none. */
export function findClassProperty(className: string, name: string): ClassProperty | undefined {
  for (const cls of [className, ...classChain(className)]) {
    const rows = ownRows(cls);
    if (!rows) continue;
    const row = rows.find(([rowName]) => rowName === name);
    if (row) return { name: row[0], type: row[1], hint: row[2], hintString: row[3], declaredBy: cls };
  }
  return undefined;
}

/** Whether Godot's ClassDB knows the class as a node or a resource. */
export function isKnownClass(className: string): boolean {
  return (
    isCatalogedType(className) ||
    className === 'Resource' ||
    Object.hasOwn(RESOURCE_BASE_TYPES_GENERATED, className)
  );
}

/**
 * Every node class a scene may name, `Node` included. The table holds a class per
 * ancestry hop, so abstract bases such as `GeometryInstance3D` are offered too: a scene
 * names them as readily as a leaf, and the engine instantiates them.
 */
export function nodeClassNames(): readonly string[] {
  return [...new Set([...Object.keys(NODE_BASE_TYPES), 'Node'])].sort((a, b) => a.localeCompare(b));
}

/** Every Resource class a `[sub_resource type="…"]` may name. */
export function resourceClassNames(): readonly string[] {
  return [...new Set([...Object.keys(RESOURCE_BASE_TYPES_GENERATED), 'Resource'])].sort((a, b) =>
    a.localeCompare(b)
  );
}
