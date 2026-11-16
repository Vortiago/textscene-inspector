import {
  fmix32,
  hashOneUint64,
  murmur3Buffer,
  murmur3One32,
  murmur3One64,
  murmur3OneDouble,
  murmur3OneFloat,
  stringHash,
  HASH_MURMUR3_SEED,
} from '../math/hashFuncs.js';
import type { NodePathParts } from '../string/nodePathParts.js';
import { MAX_RECURSION, type CallableValue, type Variant, type VariantOf } from './value/variant.js';
import {
  componentsOf,
  isStructVariant,
  MATH_LAYOUT,
  PACKED_STRUCT,
  packedComponents,
} from './value/mathLayout.js';
import { VARIANT_TYPE } from './variantType.js';

type HashOne = (word: number, seed: number) => number;

function murmur3Over(words: Iterable<number>, hashOne: HashOne): number {
  let h = HASH_MURMUR3_SEED;
  for (const word of words) h = hashOne(word, h);
  return h;
}

/** As every real_t type hashes: murmur3 over the float bits of each component, then fmix32. */
const floatsHash = (components: Iterable<number>) => fmix32(murmur3Over(components, murmur3OneFloat));

const int32Word = (component: number, seed: number) => murmur3One32(component >>> 0, seed);

/** As Vector2i, Vector3i, Vector4i and Rect2i hash: murmur3 over each int32 component, then fmix32. */
const intsHash = (components: Iterable<number>) => fmix32(murmur3Over(components, int32Word));

// variant.cpp:3048: an empty array of strings or vectors hashes as the bare seed.
function elementsHash(words: readonly number[], hashOne: HashOne): number {
  return words.length === 0 ? HASH_MURMUR3_SEED : fmix32(murmur3Over(words, hashOne));
}

function littleEndianBytes(count: number, width: number, write: (view: DataView, index: number) => void) {
  const bytes = new Uint8Array(count * width);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < count; index++) write(view, index * width);
  return bytes;
}

// variant.cpp:2985: an empty int array hashes as one 64-bit zero, not as an empty buffer.
function packedIntsHash(bytes: Uint8Array): number {
  return bytes.length === 0 ? murmur3One64(0n) : murmur3Buffer(bytes);
}

// node_path.cpp:35: the hash of the pair of names and subnames, inverted for a relative path.
function nodePathHash({ absolute, names, subnames }: NodePathParts): number {
  if (!absolute && names.length === 0 && subnames.length === 0) return 0;
  const pair = hashOneUint64(
    (BigInt(stringHash(names.join('/'))) << 32n) | BigInt(stringHash(subnames.join(':')))
  );
  return absolute ? pair : ~pair >>> 0;
}

/** `Callable::hash` (callable.cpp:254): a bind or an unbind hashes as the Callable it wraps. */
function callableHash(callable: CallableValue): number {
  switch (callable.kind) {
    case 'standard':
      return fmix32(murmur3One64(0n, stringHash(callable.method)));
    case 'variant':
      return callable.hash;
    default:
      return callableHash(callable.callable);
  }
}

/** `Array::recursive_hash` (array.cpp:195) and `Dictionary::recursive_hash` (dictionary.cpp:373). */
function containerHash(type: number, elements: readonly Variant[], depth: number): number {
  if (depth > MAX_RECURSION) return 0;
  let h = murmur3One32(type);
  for (const element of elements) h = murmur3One32(recursiveHash(element, depth + 1), h);
  return fmix32(h);
}

function recursiveHash(value: Variant, depth: number): number {
  switch (value.type) {
    case 'NIL':
      return 0;
    case 'BOOL':
      return value.value ? 1 : 0;
    case 'INT':
    case 'RID':
      return hashOneUint64(value.value);
    case 'FLOAT':
      return murmur3OneDouble(value.value);
    case 'STRING':
    case 'STRING_NAME':
      return stringHash(value.value);
    case 'NODE_PATH':
      return nodePathHash(value.value);
    case 'OBJECT':
      return hashOneUint64(0n);
    case 'CALLABLE':
      return callableHash(value.value);
    case 'SIGNAL':
      return murmur3One64(0n, stringHash(value.value));
    case 'ARRAY':
      return containerHash(VARIANT_TYPE.ARRAY, value.value, depth);
    case 'DICTIONARY':
      return containerHash(
        VARIANT_TYPE.DICTIONARY,
        value.value.flatMap(({ key, value: entry }) => [key, entry]),
        depth
      );
    default:
      return mathHash(value);
  }
}

type MathVariant = Exclude<
  Variant,
  VariantOf<
    | 'NIL'
    | 'BOOL'
    | 'INT'
    | 'RID'
    | 'FLOAT'
    | 'STRING'
    | 'STRING_NAME'
    | 'NODE_PATH'
    | 'OBJECT'
    | 'CALLABLE'
    | 'SIGNAL'
    | 'ARRAY'
    | 'DICTIONARY'
  >
>;

// variant.cpp:2805, in its order of the components. A real_t component holds a float.
function mathHash(value: MathVariant): number {
  if (isStructVariant(value)) {
    const components = componentsOf(value);
    return MATH_LAYOUT[value.type].component === 'int32' ? intsHash(components) : floatsHash(components);
  }
  return packedHash(value);
}

type PackedVariant = Extract<MathVariant, { type: `PACKED_${string}` }>;

function packedHash(value: PackedVariant): number {
  if (PACKED_STRUCT[value.type])
    return elementsHash(packedComponents(value.type, value.value), murmur3OneFloat);
  switch (value.type) {
    case 'PACKED_BYTE_ARRAY':
      return packedIntsHash(Uint8Array.from(value.value));
    case 'PACKED_INT32_ARRAY': {
      const ints = value.value;
      return packedIntsHash(
        littleEndianBytes(ints.length, 4, (view, at) => view.setInt32(at, ints[at / 4]!, true))
      );
    }
    case 'PACKED_INT64_ARRAY': {
      const ints = value.value;
      return packedIntsHash(
        littleEndianBytes(ints.length, 8, (view, at) => view.setBigInt64(at, ints[at / 8]!, true))
      );
    }
    case 'PACKED_FLOAT32_ARRAY':
      return value.value.length === 0 ? murmur3OneFloat(0) : floatsHash(value.value);
    case 'PACKED_FLOAT64_ARRAY':
      return value.value.length === 0
        ? murmur3OneDouble(0)
        : fmix32(murmur3Over(value.value, murmur3OneDouble));
    case 'PACKED_STRING_ARRAY':
      return elementsHash(value.value.map(stringHash), murmur3One32);
    case 'PACKED_VECTOR2_ARRAY':
      return elementsHash(
        value.value.flatMap(({ x, y }) => [x, y]),
        murmur3OneFloat
      );
    case 'PACKED_VECTOR3_ARRAY':
      return elementsHash(
        value.value.flatMap(({ x, y, z }) => [x, y, z]),
        murmur3OneFloat
      );
    case 'PACKED_COLOR_ARRAY':
      return elementsHash(
        value.value.flatMap(({ r, g, b, a }) => [r, g, b, a]),
        murmur3OneFloat
      );
    case 'PACKED_VECTOR4_ARRAY':
      return elementsHash(
        value.value.flatMap(({ x, y, z, w }) => [x, y, z, w]),
        murmur3OneFloat
      );
  }
}

/**
 * `Variant::hash` (variant.cpp:2801), the uint32 that `hash()` returns as an int.
 *
 * @canonical The hash of a Variant
 */
export function variantHash(value: Variant): number {
  return recursiveHash(value, 0);
}
