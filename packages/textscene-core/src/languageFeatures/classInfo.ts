import { NODE_BASE_TYPES, isCatalogedType } from '../godot/classdb/nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from '../godot/classdb/resourceBaseTypes.generated.js';
import { findClassProperty, type ClassProperty } from '../godot/classdb/classProperty.js';
import type { PropertyLocation } from './document.js';

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
