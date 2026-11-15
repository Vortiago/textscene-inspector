import { COMPONENT_VECTORS, componentsEqual } from './operators/componentVectors.js';
import { defaultValue } from './value/defaultValue.js';
import type { DictionaryEntry, Variant } from './value/variant.js';

type Components = Readonly<Record<string, number>>;

const isSameNumber = (a: number, b: number) => a === b || (Number.isNaN(a) && Number.isNaN(b));
const sameComponents = (a: object, b: object) => {
  const left = a as Components;
  const right = b as Components;
  return Object.keys(left).every((key) => isSameNumber(left[key]!, right[key]!));
};

/** The C++ `==` of two Variants of one type, or of INT and FLOAT, or of String and StringName. */
export function cppEqual(a: Variant, b: Variant): boolean {
  if (typeof a.value === 'number' || typeof a.value === 'bigint')
    return typeof a.value === typeof b.value ? a.value === b.value : Number(a.value) === Number(b.value);
  if (a.type !== b.type || typeof a.value === 'string') return a.value === b.value;
  return sameTypeEqual(a, b);
}

function sameTypeEqual(a: Variant, b: Variant): boolean {
  const vector = COMPONENT_VECTORS[a.type];
  if (vector) return componentsEqual(vector, a.value as Components, b.value as Components);
  switch (a.type) {
    case 'ARRAY':
      return arraysEqual(a.value, b.value as readonly Variant[]);
    case 'DICTIONARY':
      return dictionariesEqual(a.value, b.value as readonly DictionaryEntry[]);
    case 'PACKED_STRING_ARRAY':
    case 'PACKED_INT64_ARRAY':
    case 'PACKED_INT32_ARRAY':
    case 'PACKED_BYTE_ARRAY':
    case 'PACKED_FLOAT32_ARRAY':
    case 'PACKED_FLOAT64_ARRAY': {
      const right = b.value as readonly unknown[];
      return a.value.length === right.length && a.value.every((element, index) => element === right[index]);
    }
    default:
      return deepEqual(a.value, b.value);
  }
}

// The C++ `==` of a struct of numbers is the `==` of every field, so NaN is never equal.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === null || typeof a !== 'object') return a === b;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => deepEqual(left[key], right[key]));
}

// Array::recursive_equal and Dictionary::recursive_equal compare elements with hash_compare(false).
function arraysEqual(a: readonly Variant[], b: readonly Variant[]): boolean {
  return a.length === b.length && a.every((element, index) => hashCompare(element, b[index]!, false));
}

function dictionariesEqual(a: readonly DictionaryEntry[], b: readonly DictionaryEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(({ key, value }) => {
    const other = findEntry(b, key);
    return other !== undefined && hashCompare(value, other.value, false);
  });
}

/** `Variant::hash_compare`: NaN equals NaN in a float, a vector or a packed float array. */
function hashCompare(a: Variant, b: Variant, semantic = true): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'FLOAT':
      return a.value === b.value || (semantic && isSameNumber(a.value, b.value as number));
    case 'VECTOR2':
    case 'VECTOR3':
    case 'VECTOR4':
    case 'QUATERNION':
    case 'COLOR':
    case 'RECT2':
    case 'TRANSFORM2D':
      return sameComponents(a.value, b.value as object);
    case 'PLANE':
      return (
        sameComponents(a.value.normal, (b.value as typeof a.value).normal) &&
        isSameNumber(a.value.d, (b.value as typeof a.value).d)
      );
    case 'AABB':
      return (
        sameComponents(a.value.position, (b.value as typeof a.value).position) &&
        sameComponents(a.value.size, (b.value as typeof a.value).size)
      );
    case 'BASIS':
      return a.value.every((component, index) =>
        isSameNumber(component, (b.value as typeof a.value)[index]!)
      );
    case 'TRANSFORM3D':
      return Object.entries(a.value).every(([key, row]) =>
        sameComponents(row, (b.value as Record<string, object>)[key]!)
      );
    case 'PROJECTION':
      return a.value.every((column, index) => sameComponents(column, (b.value as typeof a.value)[index]!));
    case 'PACKED_FLOAT32_ARRAY':
    case 'PACKED_FLOAT64_ARRAY': {
      const right = b.value as readonly number[];
      return (
        a.value.length === right.length &&
        a.value.every((element, index) => isSameNumber(element, right[index]!))
      );
    }
    case 'PACKED_VECTOR2_ARRAY':
    case 'PACKED_VECTOR3_ARRAY':
    case 'PACKED_COLOR_ARRAY':
    case 'PACKED_VECTOR4_ARRAY': {
      const right = b.value as readonly object[];
      return (
        a.value.length === right.length &&
        a.value.every((element, index) => sameComponents(element, right[index]!))
      );
    }
    default:
      return cppEqual(a, b);
  }
}

/** StringLikeVariantComparator::compare (variant.cpp:3396): a String matches the StringName of its text. */
export function isSameKey(a: Variant, b: Variant): boolean {
  if (hashCompare(a, b)) return true;
  const isStringLike = (v: Variant) => v.type === 'STRING' || v.type === 'STRING_NAME';
  return isStringLike(a) && isStringLike(b) && a.type !== b.type && a.value === b.value;
}

export function findEntry(entries: readonly DictionaryEntry[], key: Variant): DictionaryEntry | undefined {
  return entries.find((entry) => isSameKey(entry.key, key));
}

/** `d[key] = value`: an existing key keeps its place in the order and takes the new value. */
export function withEntry(
  entries: readonly DictionaryEntry[],
  key: Variant,
  value: Variant
): DictionaryEntry[] {
  const index = entries.findIndex((entry) => isSameKey(entry.key, key));
  if (index < 0) return [...entries, { key, value }];
  return entries.map((entry, at) => (at === index ? { key: entry.key, value } : entry));
}

/** `Variant::is_zero`: the type's default value, or an empty container or string. */
export function isZero(value: Variant): boolean {
  if (isContainer(value)) return value.value.length === 0;
  return cppEqual(value, defaultValue(value.type));
}

function isContainer(value: Variant): value is Extract<Variant, { value: readonly unknown[] }> {
  return value.type === 'ARRAY' || value.type === 'DICTIONARY' || value.type.startsWith('PACKED_');
}

export function booleanize(value: Variant): boolean {
  return !isZero(value);
}
