import { doubleToInt32, doubleToInt64, int64ToFloat32, wrapInt32 } from '../cInteger.js';
import { cppEqual, findEntry, isSameKey } from '../compare.js';
import { stringFormat } from '../stringFormat.js';
import { isSameContainerType, typedArray } from '../construct/typedContainer.js';
import { variant, type DictionaryEntry, type Variant, type VariantOf } from '../value/variant.js';
import { type InvalidOperands, invalidWithText } from './invalidOperands.js';

/** `[] + []`: the elements of both, typed only when both are typed alike (variant_op.h:665). */
export function addArrays(a: VariantOf<'ARRAY'>, b: VariantOf<'ARRAY'>): Variant {
  const elementType = isSameContainerType(a.elementType, b.elementType) ? a.elementType : undefined;
  return typedArray([...a.value, ...b.value], elementType);
}

/** AppendArray: a packed array with the other's elements after its own. */
export function appendPacked(a: Variant, b: Variant): Variant {
  return variant(a.type, [
    ...(a.value as readonly unknown[]),
    ...(b.value as readonly unknown[]),
  ] as never) as Variant;
}

export function concatenate(a: Variant, b: Variant): Variant {
  return variant('STRING', `${a.value as string}${b.value as string}`);
}

/** StringFormat: the right operand is the list of values when it is an Array, else the one value. */
export function format(text: string, right: Variant): Variant | InvalidOperands {
  const values = right.type === 'ARRAY' ? right.value : [right];
  const formatted = stringFormat(text, values);
  return formatted.isError ? invalidWithText(formatted.text) : variant('STRING', formatted.text);
}

/** InStringFind: `String::find`, which finds no empty text. */
export function isInString(needle: string, haystack: string): boolean {
  return needle.length > 0 && haystack.includes(needle);
}

export function isInArray(value: Variant, array: readonly Variant[]): boolean {
  return array.some((element) => isSameKey(element, value));
}

export function isInDictionary(value: Variant, entries: readonly DictionaryEntry[]): boolean {
  return findEntry(entries, value) !== undefined;
}

// Vector<T>::find takes the value converted to the element type, as C++ converts it.
const PACKED_ELEMENT: Readonly<Record<string, (value: Variant) => unknown>> = {
  PACKED_BYTE_ARRAY: (v) => (v.type === 'INT' ? wrapInt32(v.value) : doubleToInt32(v.value as number)) & 0xff,
  PACKED_INT32_ARRAY: (v) => (v.type === 'INT' ? wrapInt32(v.value) : doubleToInt32(v.value as number)),
  PACKED_INT64_ARRAY: (v) => (v.type === 'INT' ? v.value : doubleToInt64(v.value as number)),
  PACKED_FLOAT32_ARRAY: (v) => (v.type === 'INT' ? int64ToFloat32(v.value) : Math.fround(v.value as number)),
  PACKED_FLOAT64_ARRAY: (v) => Number(v.value),
};

const ELEMENT_TYPE: Readonly<Record<string, Variant['type']>> = {
  PACKED_STRING_ARRAY: 'STRING',
  PACKED_VECTOR2_ARRAY: 'VECTOR2',
  PACKED_VECTOR3_ARRAY: 'VECTOR3',
  PACKED_COLOR_ARRAY: 'COLOR',
  PACKED_VECTOR4_ARRAY: 'VECTOR4',
};

export function isInPacked(value: Variant, packed: Variant): boolean {
  const elements = packed.value as readonly unknown[];
  const convert = PACKED_ELEMENT[packed.type];
  if (convert) {
    const element = convert(value);
    return elements.some((candidate) => candidate === element);
  }
  const type = ELEMENT_TYPE[packed.type]!;
  const needle = variant(type, value.value as never) as Variant;
  return elements.some((candidate) => cppEqual(variant(type, candidate as never) as Variant, needle));
}
