import { appendAll } from '../../templates/arrayWrite.js';
import type { Quaternion } from '../../math/quaternion.js';
import type { Rgba } from '../../math/math.js';
import type { Vector2, Vector3 } from '../../math/vector.js';
import { isStringLess } from '../../string/stringOrder.js';
import { codesOf } from '../../string/ustring/codes.js';
import { utf8Bytes } from '../../string/ustring/encodings.js';
import { bisect } from '../../templates/bisect.js';
import { sortArray, type Less } from '../../templates/sortArray.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { NIL, variant, type Variant, type VariantTypeName } from '../value/variant.js';
import { representableLength } from './arrayLength.js';
import { ERROR_CODE } from './errorCode.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';

/** How a Packed*Array holds, compares and writes the `T` of its `Vector<T>`. */
interface PackedElement<T> {
  /** The C++ parameter `T`, which the method's caster reads an argument as. */
  readonly parameter: MethodParameter;
  readonly stored: (argument: CastArgument) => T;
  readonly read: (element: T) => Variant;
  /** `T::operator==`, which `find`, `count`, `has` and `erase` compare by. */
  readonly isEqual: (a: T, b: T) => boolean;
  /** `Comparator<T>`, which `sort` and `bsearch` order by. */
  readonly isLess: Less<T>;
  /** `T()`, which `get` gives past the end and `resize` fills with. */
  readonly zero: T;
  /** `to_byte_array`: the bytes of the elements as memory holds them, little-endian. */
  readonly bytes?: (elements: readonly T[]) => number[];
}

const int = (value: bigint | number): Variant => variant('INT', BigInt(value));
const bool = (value: boolean): Variant => variant('BOOL', value);
const errorCode = (code: bigint): Variant => variant('INT', code);

const bytesOf = (view: ArrayBufferView) => [...new Uint8Array(view.buffer, view.byteOffset, view.byteLength)];

/** A packed array of `bytes`. */
const byteArray = (bytes: readonly number[]): Variant => variant('PACKED_BYTE_ARRAY', [...bytes]);

const isSameNumber = <T extends number | bigint | string>(a: T, b: T) => a === b;
const isNumberLess = <T extends number | bigint>(a: T, b: T) => a < b;

const BYTE_ELEMENT: PackedElement<number> = {
  parameter: 'uint8_t',
  stored: (argument) => argument as number,
  read: int,
  isEqual: isSameNumber,
  isLess: isNumberLess,
  zero: 0,
};

const INT32_ELEMENT: PackedElement<number> = {
  ...BYTE_ELEMENT,
  parameter: 'int32_t',
  bytes: (elements) => bytesOf(Int32Array.from(elements)),
};

const INT64_ELEMENT: PackedElement<bigint> = {
  parameter: 'int64_t',
  stored: (argument) => argument as bigint,
  read: int,
  isEqual: isSameNumber,
  isLess: isNumberLess,
  zero: 0n,
  bytes: (elements) => bytesOf(BigInt64Array.from(elements)),
};

const float = (value: number): Variant => variant('FLOAT', value);

const FLOAT32_ELEMENT: PackedElement<number> = {
  parameter: 'float',
  stored: (argument) => argument as number,
  read: float,
  isEqual: isSameNumber,
  isLess: isNumberLess,
  zero: 0,
  bytes: (elements) => bytesOf(Float32Array.from(elements)),
};

const FLOAT64_ELEMENT: PackedElement<number> = {
  ...FLOAT32_ELEMENT,
  parameter: 'double',
  bytes: (elements) => bytesOf(Float64Array.from(elements)),
};

const STRING_ELEMENT: PackedElement<string> = {
  parameter: 'String',
  stored: (argument) => argument as string,
  read: (element) => variant('STRING', element),
  isEqual: isSameNumber,
  isLess: isStringLess,
  zero: '',
  // `func_PackedStringArray_to_byte_array` (variant_call.cpp:1158): each text's UTF-8 and a NUL.
  bytes: (elements) => elements.flatMap((text) => [...utf8Bytes(codesOf(text)), 0]),
};

/** A Packed*Array of a math type, whose parts are each a `real_t` float. */
function partsElement<T extends object>(
  type: VariantTypeName,
  parts: readonly (keyof T)[],
  zero: T
): PackedElement<T> {
  const partsOf = (value: T) => parts.map((part) => value[part] as number);
  return {
    parameter: type,
    stored: (argument) => (argument as Variant).value as T,
    read: (element) => variant(type, element as never) as Variant,
    isEqual: (a, b) => parts.every((part) => a[part] === b[part]),
    // `operator<` of the vectors and Color (vector3.h:484, color.h:387): the first part that differs decides.
    isLess: (a, b) => {
      for (const part of parts) if (a[part] !== b[part]) return (a[part] as number) < (b[part] as number);
      return false;
    },
    zero,
    bytes: (elements) => bytesOf(Float32Array.from(elements.flatMap(partsOf))),
  };
}

const VECTOR2_ELEMENT = partsElement<Vector2>('VECTOR2', ['x', 'y'], { x: 0, y: 0 });
const VECTOR3_ELEMENT = partsElement<Vector3>('VECTOR3', ['x', 'y', 'z'], { x: 0, y: 0, z: 0 });
const VECTOR4_ELEMENT = partsElement<Quaternion>('VECTOR4', ['x', 'y', 'z', 'w'], {
  x: 0,
  y: 0,
  z: 0,
  w: 0,
});
const COLOR_ELEMENT = partsElement<Rgba>('COLOR', ['r', 'g', 'b', 'a'], { r: 0, g: 0, b: 0, a: 1 });

/** The methods every Packed*Array binds on its `Vector<T>` (variant_call.cpp:2831). */
function packedArrayMethods<T>(
  type: VariantTypeName,
  element: PackedElement<T>
): Readonly<Record<string, MethodPort>> {
  const elementsOf = (base: Variant) => base.value as unknown as T[];
  const packed = (elements: readonly T[]) => variant(type, [...elements] as never) as Variant;
  const port = (
    parameters: readonly MethodParameter[],
    body: (elements: T[], args: readonly CastArgument[]) => Variant
  ) => methodPort(parameters, (base, args) => body(elementsOf(base), args));
  const at = (args: readonly CastArgument[], index: number) => Number(args[index] as bigint);
  const value = (args: readonly CastArgument[], index: number) => element.stored(args[index]!);
  const isIndex = (index: number, elements: readonly T[]) => index >= 0 && index < elements.length;
  const parameter = element.parameter;

  /** `Vector::find` (vector.h:147): a negative start counts from the end. */
  function find(elements: readonly T[], what: T, from: number): number {
    const start = from < 0 ? elements.length + from : from;
    if (!isIndex(start, elements)) return -1;
    for (let index = start; index < elements.length; index++)
      if (element.isEqual(elements[index]!, what)) return index;
    return -1;
  }

  /** `Vector::rfind` (vector.h:156): a negative start counts from the end. */
  function rfind(elements: readonly T[], what: T, from: number): number {
    const start = from < 0 ? elements.length + from : from;
    if (!isIndex(start, elements)) return -1;
    for (let index = start; index >= 0; index--) if (element.isEqual(elements[index]!, what)) return index;
    return -1;
  }

  /** `Vector::slice` (vector.h:227): each end clamped to the size, a negative one from the end. */
  function slice(elements: readonly T[], begin: number, end: number): Variant {
    const size = elements.length;
    const clamped = (index: number) => Math.min(Math.max(index, -size), size);
    const [first, last] = [begin, end].map(clamped).map((index) => (index < 0 ? index + size : index));
    return packed(first! > last! ? [] : elements.slice(first, last));
  }

  /** `CowData::resize` (cowdata.h:395): new elements are `T()`. */
  function resize(elements: T[], size: number): Variant {
    if (size < 0) return errorCode(ERROR_CODE.ERR_INVALID_PARAMETER);
    const oldLength = elements.length;
    elements.length = representableLength(size);
    elements.fill(element.zero, oldLength);
    return errorCode(ERROR_CODE.OK);
  }

  /** `CowData::insert` (cowdata.h:299): a position from 0 to the size, none from the end. */
  function insert(elements: T[], position: number, what: T): Variant {
    if (position < 0 || position > elements.length) return errorCode(ERROR_CODE.ERR_INVALID_PARAMETER);
    elements.splice(position, 0, what);
    return errorCode(ERROR_CODE.OK);
  }

  // `push_back` answers `CowData::push_back`'s Error as a bool, so success is false (cowdata.h:335).
  const pushBack = port([parameter], (elements, args) => {
    elements.push(value(args, 0));
    return bool(false);
  });

  return {
    size: port([], (elements) => int(elements.length)),
    is_empty: port([], (elements) => bool(elements.length === 0)),
    // `VARCALL_ARRAY_GETTER_SETTER` (variant_call.cpp:660): `T()` for an index out of range.
    get: port(['int64_t'], (elements, args) =>
      element.read(isIndex(at(args, 0), elements) ? elements[at(args, 0)]! : element.zero)
    ),
    set: port(['int64_t', parameter], (elements, args) => {
      if (isIndex(at(args, 0), elements)) elements[at(args, 0)] = value(args, 1);
      return NIL;
    }),
    push_back: pushBack,
    append: pushBack,
    append_array: port([type], (elements, args) => {
      appendAll(elements, elementsOf(args[0] as Variant));
      return NIL;
    }),
    remove_at: port(['int64_t'], (elements, args) => {
      if (isIndex(at(args, 0), elements)) elements.splice(at(args, 0), 1);
      return NIL;
    }),
    insert: port(['int64_t', parameter], (elements, args) => insert(elements, at(args, 0), value(args, 1))),
    fill: port([parameter], (elements, args) => {
      elements.fill(value(args, 0));
      return NIL;
    }),
    resize: port(['int64_t'], (elements, args) => resize(elements, at(args, 0))),
    clear: port([], (elements) => {
      elements.length = 0;
      return NIL;
    }),
    has: port([parameter], (elements, args) => bool(find(elements, value(args, 0), 0) !== -1)),
    reverse: port([], (elements) => {
      elements.reverse();
      return NIL;
    }),
    slice: port(['int64_t', 'int64_t'], (elements, args) => slice(elements, at(args, 0), at(args, 1))),
    sort: port([], (elements) => {
      sortArray(elements, element.isLess);
      return NIL;
    }),
    bsearch: port([parameter, 'bool'], (elements, args) =>
      int(bisect(elements, value(args, 0), args[1] as boolean, element.isLess))
    ),
    duplicate: port([], (elements) => packed(elements)),
    find: port([parameter, 'int64_t'], (elements, args) => int(find(elements, value(args, 0), at(args, 1)))),
    rfind: port([parameter, 'int64_t'], (elements, args) =>
      int(rfind(elements, value(args, 0), at(args, 1)))
    ),
    count: port([parameter], (elements, args) =>
      int(elements.filter((item) => element.isEqual(item, value(args, 0))).length)
    ),
    erase: port([parameter], (elements, args) => {
      const index = find(elements, value(args, 0), 0);
      if (index >= 0) elements.splice(index, 1);
      return bool(index >= 0);
    }),
    ...(element.bytes && {
      to_byte_array: port([], (elements) => byteArray(element.bytes!(elements))),
    }),
  };
}

export const PACKED_BYTE_ARRAY_SHARED_METHODS = packedArrayMethods('PACKED_BYTE_ARRAY', BYTE_ELEMENT);
export const PACKED_INT32_ARRAY_METHODS = packedArrayMethods('PACKED_INT32_ARRAY', INT32_ELEMENT);
export const PACKED_INT64_ARRAY_METHODS = packedArrayMethods('PACKED_INT64_ARRAY', INT64_ELEMENT);
export const PACKED_FLOAT32_ARRAY_METHODS = packedArrayMethods('PACKED_FLOAT32_ARRAY', FLOAT32_ELEMENT);
export const PACKED_FLOAT64_ARRAY_METHODS = packedArrayMethods('PACKED_FLOAT64_ARRAY', FLOAT64_ELEMENT);
export const PACKED_STRING_ARRAY_METHODS = packedArrayMethods('PACKED_STRING_ARRAY', STRING_ELEMENT);
export const PACKED_VECTOR2_ARRAY_METHODS = packedArrayMethods('PACKED_VECTOR2_ARRAY', VECTOR2_ELEMENT);
export const PACKED_VECTOR3_ARRAY_METHODS = packedArrayMethods('PACKED_VECTOR3_ARRAY', VECTOR3_ELEMENT);
export const PACKED_COLOR_ARRAY_METHODS = packedArrayMethods('PACKED_COLOR_ARRAY', COLOR_ELEMENT);
export const PACKED_VECTOR4_ARRAY_METHODS = packedArrayMethods('PACKED_VECTOR4_ARRAY', VECTOR4_ELEMENT);
