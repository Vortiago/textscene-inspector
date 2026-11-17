import { findClassProperty, valueTypeOf, type ClassProperty } from '../godot/classdb/classProperty.js';
import { findDerivedProperty, nodeDefaultText } from '../godot/classdb/nodeDefault.js';
import { classInheritanceChain, descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { canonicalisePropertyBag } from '../godot/classdb/deprecated.js';
import { PROPERTY_HINT } from '../godot/classdb/propertyHint.js';
import { resourceTypeHint } from '../godot/classdb/resourceTypeHint.js';
import { strToVar, type VariantReading } from '../godot/variant/strToVar.js';
import { castVariant, canConvertStrict } from '../godot/variant/variantCast.js';
import { VARIANT_TYPE as T, variantTypeName } from '../godot/variant/variantType.js';
import { NIL_VALUE, type VariantValue } from '../godot/variant/variantValue.js';
import type { DerivedProperties, StoredValue, StoredWrite } from './derived/derivedProperty.js';
import { derivedPropertiesOf } from './derived/derivedFamily.js';
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
}

/** A stored property as the setters read it: the last write, else the file, else the class default. */
export function storedValueOf({ node, written, nodeReading, writtenReading }: StoredTexts): StoredValue {
  const raw = canonicalisePropertyBag(node.type, { ...node.rawProperties });
  return (property) => {
    const isWritten = Object.hasOwn(written, property);
    const text = isWritten
      ? written[property]
      : Object.hasOwn(raw, property)
        ? raw[property]
        : nodeDefaultText(node.type, property);
    if (text === undefined) return NIL_VALUE;
    const stored = findClassProperty(node.type, property);
    const value = strToVar(text, isWritten ? writtenReading : nodeReading);
    return stored ? castVariant(value, valueTypeOf(stored)) : value;
  };
}

/** Whether a resource of class `className` passes a setter's `Ref<T>` check (`binder_common.h:161-167`). */
function isAcceptedResource(property: ClassProperty, className: string | undefined): boolean {
  if (property.hint !== PROPERTY_HINT.RESOURCE_TYPE || !className) return true;
  return resourceTypeHint(property.hintString).bases.some((base) => descendsFromClass(className, base));
}

/** `class_db.cpp:1647-1690`: the setter takes the cast value. The call is valid only for a strict cast. */
function setStored(property: ClassProperty, value: VariantValue): SetOutcome {
  if (property.isSetterless) return { kind: 'dropped' };
  const to = valueTypeOf(property);
  const cast = castVariant(value, to);
  const isObject = value.type === T.OBJECT;
  if (to === T.OBJECT && isObject && !isAcceptedResource(property, value.className)) {
    return { kind: 'written', writes: [[property.name, NIL_VALUE]], isValid: false };
  }
  return { kind: 'written', writes: [[property.name, cast]], isValid: canConvertStrict(value.type, to) };
}

export function resolveSet(
  node: SceneTreeNode,
  property: string,
  value: VariantValue,
  derived: DerivedProperties | null,
  stored: StoredValue
): SetOutcome {
  const storedProperty = findClassProperty(node.type, property);
  if (storedProperty) return setStored(storedProperty, value);
  const derivedProperty = findDerivedProperty(node.type, property);
  if (!derivedProperty) return { kind: 'unknown' };
  if (!derivedProperty.hasSetter) return { kind: 'dropped' };
  const cast = castVariant(value, derivedProperty.type);
  const writes = derived?.set(property, cast, stored);
  if (!writes) return { kind: 'unported', declaredBy: derivedProperty.declaredBy };
  return { kind: 'written', writes, isValid: canConvertStrict(value.type, derivedProperty.type) };
}

/** What `get` reads of one property, or `unknown` for a name the class does not have. */
export type GetOutcome =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'unported'; readonly declaredBy: string }
  | { readonly kind: 'value'; readonly value: VariantValue };

export function resolveGet(
  node: SceneTreeNode,
  property: string,
  derived: DerivedProperties | null,
  stored: StoredValue
): GetOutcome {
  if (findClassProperty(node.type, property)) return { kind: 'value', value: stored(property) };
  const derivedProperty = findDerivedProperty(node.type, property);
  if (!derivedProperty) return { kind: 'unknown' };
  const value = derived?.get(property, stored);
  return value ? { kind: 'value', value } : { kind: 'unported', declaredBy: derivedProperty.declaredBy };
}

/** The Godot name of a value's type, as `type_string` spells it. */
export function typeNameOf(value: VariantValue): string {
  return variantTypeName(value.type) ?? 'Nil';
}
