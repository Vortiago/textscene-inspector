import { isStringLess } from '../../string/stringOrder.js';
import { codesOf } from '../../string/ustring/codes.js';
import { utf8Bytes } from '../../string/ustring/encodings.js';
import type { Less } from '../../templates/sortArray.js';
import type { CastArgument, CppParameter } from '../utility/utilityArguments.js';
import { MATH_LAYOUT, structOf, type MathTypeName } from './mathLayout.js';
import { int, real, variant, type Variant, type VariantTypeName } from './variant.js';

/** How a Packed*Array holds, compares and writes the `T` of its `Vector<T>`. */
export interface PackedElement<T> {
  /** The C++ parameter `T`, which a caster reads an argument as. */
  readonly parameter: CppParameter | VariantTypeName;
  readonly stored: (argument: CastArgument) => T;
  readonly read: (element: T) => Variant;
  /** `T::operator==`, which `find`, `count`, `has`, `erase` and `in` compare by. */
  readonly isEqual: (a: T, b: T) => boolean;
  /** `Comparator<T>`, which `sort` and `bsearch` order by. */
  readonly isLess: Less<T>;
  /** `T()`, which `get` gives past the end and `resize` fills with. */
  readonly zero: T;
  /** `to_byte_array`: the bytes of the elements as memory holds them, little-endian. */
  readonly bytes?: (elements: readonly T[]) => number[];
}

const bytesOf = (view: ArrayBufferView) => [...new Uint8Array(view.buffer, view.byteOffset, view.byteLength)];

const isSame = <T extends number | bigint | string>(a: T, b: T) => a === b;
const isNumberLess = <T extends number | bigint>(a: T, b: T) => a < b;

const BYTE_ELEMENT: PackedElement<number> = {
  parameter: 'uint8_t',
  stored: (argument) => argument as number,
  read: int,
  isEqual: isSame,
  isLess: isNumberLess,
  zero: 0,
};

const FLOAT32_ELEMENT: PackedElement<number> = {
  parameter: 'float',
  stored: (argument) => argument as number,
  read: real,
  isEqual: isSame,
  isLess: isNumberLess,
  zero: 0,
  bytes: (elements) => bytesOf(Float32Array.from(elements)),
};

/** A Packed*Array of a math type, whose components are each a `real_t` float. */
function structElement(type: MathTypeName, zero: readonly number[]): PackedElement<unknown> {
  const { flat } = MATH_LAYOUT[type] as { flat: (value: unknown) => number[] };
  return {
    parameter: type,
    stored: (argument) => (argument as Variant).value,
    read: (element) => variant(type, element as never) as Variant,
    isEqual: (a, b) => {
      const [left, right] = [flat(a), flat(b)];
      return left.every((component, index) => component === right[index]);
    },
    // vector3.h:484, color.h:387: the first component that differs decides.
    isLess: (a, b) => {
      const [left, right] = [flat(a), flat(b)];
      const index = left.findIndex((component, at) => component !== right[at]);
      return index >= 0 && left[index]! < right[index]!;
    },
    zero: structOf(type, zero).value,
    bytes: (elements) => bytesOf(Float32Array.from(elements.flatMap(flat))),
  };
}

export const PACKED_ELEMENTS = {
  PACKED_BYTE_ARRAY: BYTE_ELEMENT,
  PACKED_INT32_ARRAY: {
    ...BYTE_ELEMENT,
    parameter: 'int32_t',
    bytes: (elements) => bytesOf(Int32Array.from(elements)),
  } satisfies PackedElement<number>,
  PACKED_INT64_ARRAY: {
    parameter: 'int64_t',
    stored: (argument) => argument as bigint,
    read: int,
    isEqual: isSame,
    isLess: isNumberLess,
    zero: 0n,
    bytes: (elements) => bytesOf(BigInt64Array.from(elements)),
  } satisfies PackedElement<bigint>,
  PACKED_FLOAT32_ARRAY: FLOAT32_ELEMENT,
  PACKED_FLOAT64_ARRAY: {
    ...FLOAT32_ELEMENT,
    parameter: 'double',
    bytes: (elements) => bytesOf(Float64Array.from(elements)),
  } satisfies PackedElement<number>,
  PACKED_STRING_ARRAY: {
    parameter: 'String',
    stored: (argument) => argument as string,
    read: (element) => variant('STRING', element),
    isEqual: isSame,
    isLess: isStringLess,
    zero: '',
    // `func_PackedStringArray_to_byte_array` (variant_call.cpp:1158): each text's UTF-8 and a NUL.
    bytes: (elements) => elements.flatMap((text) => [...utf8Bytes(codesOf(text)), 0]),
  } satisfies PackedElement<string>,
  PACKED_VECTOR2_ARRAY: structElement('VECTOR2', [0, 0]),
  PACKED_VECTOR3_ARRAY: structElement('VECTOR3', [0, 0, 0]),
  PACKED_COLOR_ARRAY: structElement('COLOR', [0, 0, 0, 1]),
  PACKED_VECTOR4_ARRAY: structElement('VECTOR4', [0, 0, 0, 0]),
} as const;

export type PackedTypeName = keyof typeof PACKED_ELEMENTS;

export const isPackedType = (type: string): type is PackedTypeName => Object.hasOwn(PACKED_ELEMENTS, type);

const elementOf = (type: PackedTypeName) => PACKED_ELEMENTS[type] as PackedElement<unknown>;

/** Each element of a packed array as a Variant: its ints as INT and its floats as FLOAT. */
export const packedElements = (packed: Variant): Variant[] =>
  (packed.value as readonly unknown[]).map(elementOf(packed.type as PackedTypeName).read);
