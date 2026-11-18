import { findEntry, isSameKey } from '../compare.js';
import { stringFormat } from '../stringFormat.js';
import { isSameContainerType, typedArray } from '../construct/typedContainer.js';
import { variant, type DictionaryEntry, type Variant, type VariantOf } from '../value/variant.js';
import { type InvalidOperands, invalidWithText } from './invalidOperands.js';
import { PACKED_ELEMENTS, type PackedElement, type PackedTypeName } from '../value/packedElements.js';
import { castTo } from '../utility/utilityArguments.js';

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
export function isInPacked(value: Variant, packed: Variant): boolean {
  const element = PACKED_ELEMENTS[packed.type as PackedTypeName] as PackedElement<unknown>;
  const needle = element.stored(castTo(value, element.parameter));
  return (packed.value as readonly unknown[]).some((candidate) => element.isEqual(candidate, needle));
}
