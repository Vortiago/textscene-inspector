import { findClassProperty, valueTypeOf, type ClassProperty } from '../godot/classdb/classProperty.js';
import { findDerivedProperty, nodeDefaultText } from '../godot/classdb/nodeDefault.js';
import { classInheritanceChain, classInTree, descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { canonicalisePropertyBag } from '../godot/classdb/deprecated.js';
import { perObject } from '../utils/perObject.js';
import { withLoadedParamRanges } from '../nodes/shared/cpuparticles/params.js';
import { PROPERTY_HINT } from '../godot/classdb/propertyHint.js';
import { resourceTypeHint } from '../godot/classdb/resourceTypeHint.js';
import { strToVar, type VariantReading } from '../godot/variant/strToVar.js';
import { castVariant, canConvertStrict } from '../godot/variant/variantCast.js';
import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import { NIL_VALUE, type VariantValue } from '../godot/variant/variantValue.js';
import type { DerivedProperties, NodeReads, StoredValue, StoredWrite } from './derived/derivedProperty.js';
import { derivedPropertiesOf } from './derived/derivedFamily.js';
import { listedGet, type ListedReads } from './listed/listedProperties.js';
import type { SceneTreeNode } from './sceneRuntime.js';
import type { PropertyTexts } from './sceneWrites.js';

export { derivedPropertiesOf };

/** What `set` does with one property of one node. */
export type SetOutcome =
  | { readonly kind: 'unknown' }
  /** A property Godot has whose setter this previewer does not port. */
  | { readonly kind: 'unported'; readonly declaredBy: string }
  /** Each stored property the setter writes, and whether Godot reports the call valid. */
  | { readonly kind: 'written'; readonly writes: readonly StoredWrite[]; readonly isValid: boolean }
  /** A property with no setter: Godot drops the write and reports it invalid (`class_db.cpp:1655-1659`). */
  | { readonly kind: 'dropped' };

/** Whether Godot's ClassDB knows `className`, for a value that names a class. */
export function classExists(className: string): boolean {
  return classInheritanceChain(className).at(-1) === 'Object';
}

/** The texts of one node's stored properties, each with the reading its resource ids resolve in. */
export interface StoredTexts {
  readonly node: SceneTreeNode;
  /** The host's writes, which name resources in the root scene's ids. */
  readonly written: PropertyTexts;
  readonly nodeReading: VariantReading;
  readonly writtenReading: VariantReading;
  /** The pose a live pass over the written scene lays, so a write to a relay moves its target. */
  readonly placedProperty: (property: string) => VariantValue | undefined;
}

/** A node's texts as its setters leave them on load. Built once for each node, as each `get` reads them. */
const loadedTextsOf = perObject((node: SceneTreeNode): Readonly<Record<string, string>> => {
  const className = classInTree(node.type);
  return withLoadedParamRanges(className, canonicalisePropertyBag(className, { ...node.rawProperties }));
});

/** A stored property as the setters read it: the last write, a live pass, the file, then the default. */
export function storedValueOf({
  node,
  written,
  nodeReading,
  writtenReading,
  placedProperty,
}: StoredTexts): StoredValue {
  const className = classInTree(node.type);
  const raw = loadedTextsOf(node);
  // One parse per property for each call: a setter such as `global_position` reads one many times.
  const values = new Map<string, VariantValue>();
  const valueOf = (property: string): VariantValue => {
    const isWritten = Object.hasOwn(written, property);
    const placed = isWritten ? undefined : placedProperty(property);
    if (placed) return placed;
    const text = isWritten
      ? written[property]
      : Object.hasOwn(raw, property)
        ? raw[property]
        : nodeDefaultText(className, property);
    if (text === undefined) return NIL_VALUE;
    const stored = findClassProperty(className, property);
    const value = strToVar(text, isWritten ? writtenReading : nodeReading);
    return stored ? castVariant(value, valueTypeOf(stored)) : value;
  };
  return (property) => {
    let value = values.get(property);
    if (value === undefined) values.set(property, (value = valueOf(property)));
    return value;
  };
}

/** Whether a resource of class `className` passes a setter's `Ref<T>` check (`binder_common.h:161-167`). */
function isAcceptedResource(property: ClassProperty, className: string | undefined): boolean {
  if (property.hint !== PROPERTY_HINT.RESOURCE_TYPE || !className) return true;
  return resourceTypeHint(property.hintString).bases.some((base) => descendsFromClass(className, base));
}

/** `class_db.cpp:1647-1690`: the setter takes the cast value. The call is valid only for a strict cast. */
function setStored(property: ClassProperty, value: VariantValue): SetOutcome {
  const to = valueTypeOf(property);
  const cast = castVariant(value, to);
  const isObject = value.type === T.OBJECT;
  if (to === T.OBJECT && isObject && !isAcceptedResource(property, value.className)) {
    return { kind: 'written', writes: [[property.name, NIL_VALUE]], isValid: false };
  }
  return { kind: 'written', writes: [[property.name, cast]], isValid: canConvertStrict(value.type, to) };
}

/** A ported family answers first: a stored setter, as a Control's anchor, can write more than itself. */
export function resolveSet(
  node: SceneTreeNode,
  property: string,
  value: VariantValue,
  derived: DerivedProperties | null,
  reads: NodeReads
): SetOutcome {
  const className = classInTree(node.type);
  const storedProperty = findClassProperty(className, property);
  if (storedProperty) {
    if (storedProperty.isSetterless) return { kind: 'dropped' };
    const to = valueTypeOf(storedProperty);
    const writes = derived?.set(property, castVariant(value, to), reads);
    if (writes) return { kind: 'written', writes, isValid: canConvertStrict(value.type, to) };
    return setStored(storedProperty, value);
  }
  const derivedProperty = findDerivedProperty(className, property);
  if (!derivedProperty) return { kind: 'unknown' };
  if (!derivedProperty.hasSetter) return { kind: 'dropped' };
  const writes = derived?.set(property, castVariant(value, derivedProperty.type), reads);
  if (!writes) return { kind: 'unported', declaredBy: derivedProperty.declaredBy };
  return { kind: 'written', writes, isValid: canConvertStrict(value.type, derivedProperty.type) };
}

/** The value a setter takes, cast to the property's type, and whether `Object::set` reports it valid. */
export function castForSetter(
  className: string,
  property: string,
  value: VariantValue
): { readonly value: VariantValue; readonly isValid: boolean } {
  const stored = findClassProperty(className, property);
  const to = stored ? valueTypeOf(stored) : (findDerivedProperty(className, property)?.type ?? T.NIL);
  return { value: castVariant(value, to), isValid: canConvertStrict(value.type, to) };
}

/** What `get` reads of one property, or `unknown` for a name the class does not have. */
export type GetOutcome =
  | { readonly kind: 'unknown' }
  /** A name the class's own `_get` routes and refuses, such as a bone past the last: null, unwarned. */
  | { readonly kind: 'refused' }
  | { readonly kind: 'unported'; readonly declaredBy: string }
  | { readonly kind: 'value'; readonly value: VariantValue };

/** `get` of a ClassDB row or a derived property, `unknown` for a name only a class's `_get` routes. */
export function resolveClassGet(
  node: SceneTreeNode,
  property: string,
  derived: DerivedProperties | null,
  reads: NodeReads
): GetOutcome {
  const className = classInTree(node.type);
  if (findClassProperty(className, property)) return { kind: 'value', value: reads.stored(property) };
  const derivedProperty = findDerivedProperty(className, property);
  if (!derivedProperty) return { kind: 'unknown' };
  const value = derived?.get(property, reads);
  return value ? { kind: 'value', value } : { kind: 'unported', declaredBy: derivedProperty.declaredBy };
}

/** `get`: the class's own property first, then the class's `_get`, which may load the resource it reads. */
export async function resolveGet(
  node: SceneTreeNode,
  property: string,
  derived: DerivedProperties | null,
  reads: NodeReads,
  resource: ListedReads['resource']
): Promise<GetOutcome> {
  const outcome = resolveClassGet(node, property, derived, reads);
  if (outcome.kind !== 'unknown') return outcome;
  return listedGet(classInTree(node.type), property, {
    texts: node.rawProperties,
    stored: reads.stored,
    resource,
  });
}
