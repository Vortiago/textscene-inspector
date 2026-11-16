import { COMPONENT_VECTORS, componentsEqual } from './operators/componentVectors.js';
import { defaultValue } from './value/defaultValue.js';
import {
  componentsOf,
  isStructVariant,
  MATH_LAYOUT,
  PACKED_STRUCT,
  packedComponents,
  type StructVariant,
} from './value/mathLayout.js';
import { MAX_RECURSION, type CallableValue, type DictionaryEntry, type Variant } from './value/variant.js';

type Components = Readonly<Record<string, number>>;

const isSameNumber = (a: number, b: number) => a === b || (Number.isNaN(a) && Number.isNaN(b));

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
    case 'CALLABLE':
      return callablesEqual(a.value, b.value as CallableValue);
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

/** `Callable::operator==` (callable.cpp:264): two kinds never equal, and a bind compares no bound value. */
function callablesEqual(a: CallableValue, b: CallableValue): boolean {
  if (a === b) return true;
  switch (a.kind) {
    case 'standard':
      return b.kind === 'standard' && a.method === b.method;
    case 'variant':
      return b.kind === 'variant' && a.hash === b.hash;
    case 'bind':
      return b.kind === 'bind' && callablesEqual(a.callable, b.callable) && a.binds.length === b.binds.length;
    case 'unbind':
      return b.kind === 'unbind' && callablesEqual(a.callable, b.callable) && a.count === b.count;
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

/** `Array::recursive_equal` (array.cpp:98): equal past MAX_RECURSION, after an error Godot only prints. */
function arraysEqual(a: readonly Variant[], b: readonly Variant[], depth = 0): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  if (depth > MAX_RECURSION) return true;
  return a.every((element, index) => hashCompare(element, b[index]!, false, depth + 1));
}

/** `Dictionary::recursive_equal` (dictionary.cpp:219), the method `recursive_equal` runs too. */
export function dictionariesEqual(
  a: readonly DictionaryEntry[],
  b: readonly DictionaryEntry[],
  depth = 0
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  if (depth > MAX_RECURSION) return true;
  return a.every(({ key, value }) => {
    const other = findEntry(b, key);
    return other !== undefined && hashCompare(value, other.value, false, depth + 1);
  });
}

/** `Variant::hash_compare` (variant.cpp:3172): NaN equals NaN in a float, a vector or a packed array. */
export function hashCompare(a: Variant, b: Variant, semantic = true, depth = 0): boolean {
  if (a.type !== b.type) return false;
  if (isStructVariant(a) && MATH_LAYOUT[a.type].component !== 'int32')
    return sameNumbers(componentsOf(a), componentsOf(b as StructVariant));
  if (PACKED_STRUCT[a.type]) return samePackedStructs(a.type, a.value as [], b.value as []);
  switch (a.type) {
    case 'ARRAY':
      return arraysEqual(a.value, b.value as readonly Variant[], depth + 1);
    case 'DICTIONARY':
      return dictionariesEqual(a.value, b.value as readonly DictionaryEntry[], depth + 1);
    case 'FLOAT':
      return a.value === b.value || (semantic && isSameNumber(a.value, b.value as number));
    case 'PACKED_FLOAT32_ARRAY':
    case 'PACKED_FLOAT64_ARRAY':
      return sameNumbers(a.value, b.value as readonly number[]);
    default:
      return cppEqual(a, b);
  }
}

// Lengths first: two packed arrays of different lengths are unequal before any element is flattened.
const samePackedStructs = (type: string, left: readonly unknown[], right: readonly unknown[]) =>
  left.length === right.length && sameNumbers(packedComponents(type, left), packedComponents(type, right));

const sameNumbers = (left: readonly number[], right: readonly number[]) =>
  left.length === right.length && left.every((element, index) => isSameNumber(element, right[index]!));

/** StringLikeVariantComparator::compare (variant.cpp:3396): a String matches the StringName of its text. */
export function isSameKey(a: Variant, b: Variant): boolean {
  if (hashCompare(a, b)) return true;
  const isStringLike = (v: Variant) => v.type === 'STRING' || v.type === 'STRING_NAME';
  return isStringLike(a) && isStringLike(b) && a.type !== b.type && a.value === b.value;
}

const SHARED_BY_REFERENCE = /^(ARRAY|DICTIONARY|PACKED_.*)$/;

/** `Variant::identity_compare` (variant.cpp:3355): a container by its allocation, an OBJECT by its id. */
export function identityCompare(a: Variant, b: Variant): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'OBJECT') return true;
  return SHARED_BY_REFERENCE.test(a.type) ? a.value === b.value : hashCompare(a, b);
}

export function findEntry(entries: readonly DictionaryEntry[], key: Variant): DictionaryEntry | undefined {
  return entries.find((entry) => isSameKey(entry.key, key));
}

/** `d[key] = value` on `entries`: an existing key keeps its place in the order and takes the new value. */
export function setEntry(entries: DictionaryEntry[], key: Variant, value: Variant): void {
  const index = entries.findIndex((entry) => isSameKey(entry.key, key));
  if (index < 0) entries.push({ key, value });
  else entries[index] = { key: entries[index]!.key, value };
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
