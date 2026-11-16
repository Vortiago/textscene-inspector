import { appendAll } from '../../templates/arrayWrite.js';
import { bisect } from '../../templates/bisect.js';
import { sortArray } from '../../templates/sortArray.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { NIL, bool, int, variant, type Variant, type VariantTypeName } from '../value/variant.js';
import { PACKED_ELEMENTS, type PackedElement } from '../value/packedElements.js';
import { representableLength } from './arrayLength.js';
import { ERROR_CODE } from './errorCode.js';
import { type MethodPort, portOn } from './methodPort.js';

const errorCode = (code: bigint): Variant => variant('INT', code);

/** A packed array of `bytes`. */
const byteArray = (bytes: readonly number[]): Variant => variant('PACKED_BYTE_ARRAY', [...bytes]);

/** The methods every Packed*Array binds on its `Vector<T>` (variant_call.cpp:2831). */
function packedArrayMethods<T>(
  type: VariantTypeName,
  element: PackedElement<T>
): Readonly<Record<string, MethodPort>> {
  const elementsOf = (base: Variant) => base.value as unknown as T[];
  const packed = (elements: readonly T[]) => variant(type, [...elements] as never) as Variant;
  const port = portOn(elementsOf);
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

export const PACKED_BYTE_ARRAY_SHARED_METHODS = packedArrayMethods(
  'PACKED_BYTE_ARRAY',
  PACKED_ELEMENTS.PACKED_BYTE_ARRAY
);
export const PACKED_INT32_ARRAY_METHODS = packedArrayMethods(
  'PACKED_INT32_ARRAY',
  PACKED_ELEMENTS.PACKED_INT32_ARRAY
);
export const PACKED_INT64_ARRAY_METHODS = packedArrayMethods(
  'PACKED_INT64_ARRAY',
  PACKED_ELEMENTS.PACKED_INT64_ARRAY
);
export const PACKED_FLOAT32_ARRAY_METHODS = packedArrayMethods(
  'PACKED_FLOAT32_ARRAY',
  PACKED_ELEMENTS.PACKED_FLOAT32_ARRAY
);
export const PACKED_FLOAT64_ARRAY_METHODS = packedArrayMethods(
  'PACKED_FLOAT64_ARRAY',
  PACKED_ELEMENTS.PACKED_FLOAT64_ARRAY
);
export const PACKED_STRING_ARRAY_METHODS = packedArrayMethods(
  'PACKED_STRING_ARRAY',
  PACKED_ELEMENTS.PACKED_STRING_ARRAY
);
export const PACKED_VECTOR2_ARRAY_METHODS = packedArrayMethods(
  'PACKED_VECTOR2_ARRAY',
  PACKED_ELEMENTS.PACKED_VECTOR2_ARRAY
);
export const PACKED_VECTOR3_ARRAY_METHODS = packedArrayMethods(
  'PACKED_VECTOR3_ARRAY',
  PACKED_ELEMENTS.PACKED_VECTOR3_ARRAY
);
export const PACKED_COLOR_ARRAY_METHODS = packedArrayMethods(
  'PACKED_COLOR_ARRAY',
  PACKED_ELEMENTS.PACKED_COLOR_ARRAY
);
export const PACKED_VECTOR4_ARRAY_METHODS = packedArrayMethods(
  'PACKED_VECTOR4_ARRAY',
  PACKED_ELEMENTS.PACKED_VECTOR4_ARRAY
);
