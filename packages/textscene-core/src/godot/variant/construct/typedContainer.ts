import { classInheritanceChain } from '../../classdb/classBaseTypes.js';
import { setEntry } from '../compare.js';
import {
  variant,
  type ContainerType,
  type DictionaryEntry,
  type Variant,
  type VariantOf,
  type VariantTypeName,
} from '../value/variant.js';
import { VARIANT_TYPE, variantTypeOf } from '../variantType.js';
import { construct } from './construct.js';
import { canConvertStrict } from './variantCast.js';

const OBJECT = VARIANT_TYPE.OBJECT;

const typeNumber = (container: ContainerType | undefined) => container?.type ?? VARIANT_TYPE.NIL;

/** `ContainerTypeValidate::operator==` (container_type_validate.h:183). */
export function isSameContainerType(a: ContainerType | undefined, b: ContainerType | undefined): boolean {
  return typeNumber(a) === typeNumber(b) && (a?.className ?? '') === (b?.className ?? '');
}

/** `ContainerTypeValidate::can_reference` (container_type_validate.h:158), over the known classes. */
export function canReference(target: ContainerType | undefined, source: ContainerType | undefined): boolean {
  if (typeNumber(target) !== typeNumber(source)) return false;
  if (typeNumber(target) !== OBJECT || !target!.className) return true;
  if (!source!.className) return false;
  return classInheritanceChain(source!.className).includes(target!.className);
}

// Variant::can_convert_strict refuses a type past the last one (variant.cpp:539).
function canConvertStrictTo(from: VariantTypeName, to: number): boolean {
  const target = variantTypeOf(to);
  return target !== undefined && canConvertStrict(from, target);
}

const convertedTo = (element: Variant, to: number) => construct(variantTypeOf(to)!, [element]);

// An expression's objects are all null, which every class takes (container_type_validate.h:91).
const isNullObject = (element: Variant) => element.type === 'NIL' || element.type === 'OBJECT';

/** The elements `Array::assign` (array.cpp:217) gives a container of `target`, or nothing on its error. */
export function assignedElements(
  elements: readonly Variant[],
  source: ContainerType | undefined,
  target: ContainerType | undefined
): readonly Variant[] | undefined {
  if (
    isSameContainerType(target, source) ||
    !target ||
    (typeNumber(source) === OBJECT && canReference(target, source))
  )
    return elements;
  if ((!source && target.type === OBJECT) || (typeNumber(source) === OBJECT && canReference(source, target)))
    return elements.every(isNullObject) ? elements : undefined;
  if (target.type === OBJECT || typeNumber(source) === OBJECT) return undefined;
  if (!source)
    return convertEach(elements, target.type, (element) => element.type !== variantTypeOf(target.type));
  if (!canConvertStrictTo(variantTypeOf(source.type) ?? 'NIL', target.type)) return undefined;
  return convertEach(elements, target.type, () => true);
}

function convertEach(
  elements: readonly Variant[],
  to: number,
  needsConversion: (element: Variant) => boolean
): Variant[] | undefined {
  const converted: Variant[] = [];
  for (const element of elements) {
    if (!needsConversion(element)) {
      converted.push(element);
      continue;
    }
    if (!canConvertStrictTo(element.type, to)) return undefined;
    const value = convertedTo(element, to);
    if (!value) return undefined;
    converted.push(value);
  }
  return converted;
}

/** `ContainerTypeValidate::validate` (container_type_validate.h:49): the stored element, or none. */
export function validatedElement(element: Variant, type: ContainerType | undefined): Variant | undefined {
  const target = typeNumber(type);
  if (target === VARIANT_TYPE.NIL || variantTypeOf(target) === element.type) return element;
  if (element.type === 'NIL' && target === OBJECT) return element;
  return canConvertStrictTo(element.type, target) ? convertedTo(element, target) : undefined;
}

const typing = (type: ContainerType | undefined) =>
  type && type.type !== VARIANT_TYPE.NIL ? type : undefined;

/** An Array of `elements` typed as `elementType`, untyped for NIL. */
export function typedArray(
  elements: readonly Variant[],
  elementType: ContainerType | undefined
): VariantOf<'ARRAY'> {
  const type = typing(elementType);
  return type ? { ...variant('ARRAY', elements), elementType: type } : variant('ARRAY', elements);
}

/** A Dictionary of `entries` typed as `keyType` and `valueType`, each untyped for NIL. */
export function typedDictionary(
  entries: readonly DictionaryEntry[],
  keyType: ContainerType | undefined,
  valueType: ContainerType | undefined
): VariantOf<'DICTIONARY'> {
  const [key, value] = [typing(keyType), typing(valueType)];
  return {
    ...variant('DICTIONARY', entries),
    ...(key && { keyType: key }),
    ...(value && { valueType: value }),
  };
}

/** `Array(base, type, class_name, script)` (array.cpp:874): a new array, empty on a failed assign. */
export function assignArray(base: VariantOf<'ARRAY'>, elementType: ContainerType): VariantOf<'ARRAY'> {
  const elements = assignedElements(base.value, base.elementType, typing(elementType)) ?? [];
  return typedArray([...elements], elementType);
}

/** The entries `Dictionary::assign` (dictionary.cpp:351) gives a dictionary of these types, or none. */
export function assignedEntries(
  source: VariantOf<'DICTIONARY'>,
  keyType: ContainerType | undefined,
  valueType: ContainerType | undefined
): DictionaryEntry[] | undefined {
  const keys = assignedElements(
    source.value.map(({ key }) => key),
    source.keyType,
    typing(keyType)
  );
  const values =
    keys &&
    assignedElements(
      source.value.map(({ value }) => value),
      source.valueType,
      typing(valueType)
    );
  if (!keys || !values) return undefined;
  const entries: DictionaryEntry[] = [];
  keys.forEach((key, index) => setEntry(entries, key, values[index]!));
  return entries;
}

/** `Dictionary(base, key and value types)` (dictionary.cpp:757): an empty typed one on a failed assign. */
export function assignDictionary(
  base: VariantOf<'DICTIONARY'>,
  keyType: ContainerType,
  valueType: ContainerType
): VariantOf<'DICTIONARY'> {
  return typedDictionary(assignedEntries(base, keyType, valueType) ?? [], keyType, valueType);
}

/** `Ref<Script>()` as a Variant: an expression's containers hold no script, so each answers a null Object. */
export const NULL_SCRIPT = variant('OBJECT', null);
