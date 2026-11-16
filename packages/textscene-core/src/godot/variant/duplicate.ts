import { setEntry } from './compare.js';
import { typedArray, typedDictionary } from './construct/typedContainer.js';
import { MAX_RECURSION, type DictionaryEntry, type Variant, type VariantOf } from './value/variant.js';

/** `Array::recursive_duplicate` (array.cpp:537): empty past MAX_RECURSION, after a printed error. */
function duplicateArray(array: VariantOf<'ARRAY'>, isDeep: boolean, depth: number): Variant {
  if (depth > MAX_RECURSION) return typedArray([], array.elementType);
  const elements = isDeep ? array.value.map((element) => duplicateAt(element, depth + 1)) : [...array.value];
  return typedArray(elements, array.elementType);
}

/** `Dictionary::recursive_duplicate` (dictionary.cpp:612). */
function duplicateDictionary(dictionary: VariantOf<'DICTIONARY'>, isDeep: boolean, depth: number): Variant {
  const { keyType, valueType } = dictionary;
  if (depth > MAX_RECURSION) return typedDictionary([], keyType, valueType);
  if (!isDeep) return typedDictionary([...dictionary.value], keyType, valueType);
  const entries: DictionaryEntry[] = [];
  for (const { key, value } of dictionary.value)
    setEntry(entries, duplicateAt(key, depth + 1), duplicateAt(value, depth + 1));
  return typedDictionary(entries, keyType, valueType);
}

const duplicateAt = (value: Variant, depth: number) => recursiveDuplicate(value, true, depth);

// An expression's objects are all null, so no Resource is ever duplicated.
function recursiveDuplicate(value: Variant, isDeep: boolean, depth: number): Variant {
  if (value.type === 'ARRAY') return duplicateArray(value, isDeep, depth);
  if (value.type === 'DICTIONARY') return duplicateDictionary(value, isDeep, depth);
  if (value.type.startsWith('PACKED_'))
    return { ...value, value: [...(value.value as unknown[])] } as Variant;
  return value;
}

/** `Variant::duplicate` (variant_setget.cpp:1972): a new container, with its elements copied when deep. */
export const duplicateVariant = (value: Variant, isDeep: boolean): Variant =>
  recursiveDuplicate(value, isDeep, 0);
