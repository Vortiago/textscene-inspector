/**
 * Readers for Godot's packed array slots, THREE-free: a flat float body, the three spellings
 * of a packed tuple slot, and the nested index arrays of a polygon list.
 */

import {
  literalText,
  STRING_LITERAL_RE,
  packedArrayBody,
  packedArrayCallAnywhere,
  packedArrayForms,
  packedArrayLiteral,
  packedElementType,
  parseGodotFloat,
  parseGodotInt,
  splitTopLevel,
} from '../../godot/index.js';
import { toUint8 } from '../../godot/intWidth.js';
import { decodeBase64Bytes } from '../../godot/packedBytes.js';
import { arrayLiteralBody } from '../../godot/variantParser.js';

/**
 * A packed array of fixed-size tuples, named once: its type, the three spellings its slot
 * takes, and the components in each element.
 */
interface PackedTupleType {
  readonly typeName: string;
  readonly forms: readonly RegExp[];
  readonly groupSize: number;
}

function packedTupleType(typeName: string, groupSize: number): PackedTupleType {
  return { typeName, forms: packedArrayForms(typeName), groupSize };
}

/**
 * Elements of a packed float body as Godot's tokenizer reads them, so `1.2.3`,
 * `+1` and `.5` throw, not `parseFloat`'s prefix. A non-finite is a legal element
 * the writer emits (`rtos_fix`) and still throws: callers catch and draw nothing,
 * where 0 would put an unasked-for vertex at the origin.
 */
export function floatElements(inner: string, wrapper: string, value: string): number[] {
  return inner.split(',').map((s) => {
    const num = parseGodotFloat(s);
    if (num === null || !Number.isFinite(num)) {
      throw new Error(`Invalid number in ${wrapper}: ${value}`);
    }
    return num;
  });
}

/**
 * A packed tuple slot in any of its three spellings, as the constructor's flat components at
 * double precision, for the caller to narrow to the precision its slot stores. The bare and typed bodies hold one element
 * per top-level comma, and another group size throws rather than add a short vertex: Godot makes
 * no such conversion.
 */
export function packedTupleNumbers(value: string, type: PackedTupleType): number[] {
  const { typeName, forms, groupSize } = type;
  const matched = packedArrayBody(forms, value);
  if (!matched) throw new Error(`Invalid ${typeName} format: ${value}`);
  if (matched.body === '') return [];
  if (matched.flat) return floatElements(matched.body, typeName, value);

  const elementRe = packedArrayLiteral(packedElementType(typeName));
  const out: number[] = [];
  for (const part of splitTopLevel(matched.body)) {
    // A trailing comma leaves one empty part, and Godot's array reader closes on
    // the bracket before demanding another value (variant_parser.cpp:1658-1662),
    // so it is no element. The validator skips it the same way.
    if (part === '') continue;
    const element = elementRe.exec(part);
    if (!element) throw new Error(`Invalid ${typeName} format: ${value}`);
    const components = floatElements(element[1]!, typeName, value);
    if (components.length !== groupSize) throw new Error(`Invalid ${typeName} format: ${value}`);
    out.push(...components);
  }
  return out;
}

// All three spellings each slot loads: `can_convert_strict` lists ARRAY as a source
// for every PACKED_* type (variant.cpp:467-473).
const PACKED_FLOAT32_FORMS = packedArrayForms('PackedFloat32Array');

/** Parse a `PackedFloat32Array` slot, in any of its three spellings, into a `number[]`. */
export function parsePackedFloat32Array(value: string): number[] {
  const matched = packedArrayBody(PACKED_FLOAT32_FORMS, value);
  if (!matched) {
    throw new Error(`Invalid PackedFloat32Array format: ${value}`);
  }
  // A scalar slot's bare and typed bodies are the same comma-separated numbers
  // the constructor's flat argument list holds, so one reader covers all three.
  if (matched.body === '') return [];
  return floatElements(matched.body, 'PackedFloat32Array', value);
}

/** The float32 reader of one packed tuple type, the precision geometry callers take. */
function float32Reader(type: PackedTupleType): (value: string) => Float32Array {
  return (value) => new Float32Array(packedTupleNumbers(value, type));
}

const PACKED_COLOR_ARRAY = packedTupleType('PackedColorArray', 4);

/** A Godot `PackedVector3Array` slot as flat components. */
export const parsePackedVector3Array = float32Reader(packedTupleType('PackedVector3Array', 3));

/** A Godot `PackedVector2Array` slot as flat components. */
export const parsePackedVector2Array = float32Reader(packedTupleType('PackedVector2Array', 2));

/** A Godot `PackedColorArray` slot as flat components. */
export const parsePackedColorArray = float32Reader(PACKED_COLOR_ARRAY);

const PACKED_BYTE_FORMS = packedArrayForms('PackedByteArray');

/**
 * A `PackedByteArray` slot as its bytes: the base64 body Godot's writer gives a file with an array
 * over 64 bytes (`resource_format_text.cpp:1724-1732`), or the element list. Each element is an
 * int Variant narrowed by `(uint8_t)` (`variant_parser.cpp:650`, `variant.h:442`), so -1 stores 255.
 * Throws on a body Godot cannot read.
 */
export function parsePackedByteArray(value: string): Uint8Array {
  const matched = packedArrayBody(PACKED_BYTE_FORMS, value);
  if (!matched) throw new Error(`Invalid PackedByteArray format: ${value}`);
  const base64 = STRING_LITERAL_RE.exec(matched.body) ? literalText(matched.body) : null;
  if (base64 !== null) return decodeBase64Bytes(base64);
  if (matched.body === '') return new Uint8Array(0);
  return Uint8Array.from(matched.body.split(','), (part) => {
    const element = parseGodotInt(part, 'int64');
    if (element === null || Number.isNaN(element))
      throw new Error(`Invalid number in PackedByteArray: ${value}`);
    return toUint8(element);
  });
}

/** One `[...]` group nested inside an outer array, its body captured. */
const BARE_INNER_ARRAY_RE = /\[([^[\]]*)\]/g;

const PACKED_INT32_CALLS = packedArrayCallAnywhere('PackedInt32Array');

/**
 * Every sub-array of indices, in each spelling Godot loads: `[PackedInt32Array(...), ...]`,
 * `Array[PackedInt32Array]([PackedInt32Array(...), ...])`, and `[[0, 1, 2], [0, 2, 3]]`.
 * The last is the declared untyped ARRAY (`polygon_2d.cpp:720`, and `set_polygons`
 * takes a `const Array &`), measured on 4.6.3 as two sub-polygons.
 */
export function parsePackedInt32Arrays(value: string): number[][] {
  return subArrayBodies(value).map((body) => parseIndices(body.trim(), value));
}

/** The body of each sub-array, in whichever spelling the value holds. */
function subArrayBodies(value: string): string[] {
  const calls = PACKED_INT32_CALLS.all(value);
  if (calls.length > 0) return calls;
  // The outer brackets go first: a `[...]` scan over the whole value matches
  // them, so `[]` would read as one empty sub-polygon. `Array[T]([…])` loads too
  // (`can_convert_strict` lists ARRAY for every PACKED_* type), and unwrapping
  // it leaves the body the bare form scans.
  const outer = arrayLiteralBody(value);
  if (outer === null) return [];
  return Array.from(outer.matchAll(BARE_INNER_ARRAY_RE), (match) => match[1]!);
}

/** One sub-array's indices. `value` is the whole slot, for the error message. */
function parseIndices(body: string, value: string): number[] {
  if (body === '') return [];
  return body.split(',').map((s) => {
    const num = parseGodotInt(s);
    // A body Godot's tokenizer refuses throws rather than become a NaN
    // index, and `2e1` reads as the 20 Godot loads. A non-finite would clear
    // every range check and index arbitrary geometry.
    if (num === null || !Number.isFinite(num)) {
      throw new Error(`Invalid number in PackedInt32Array: ${value}`);
    }
    return num;
  });
}

/**
 * Fan-triangulate a convex polygon's vertex-index loop `[i0, i1, …, iN]` into a
 * flat triangle-index list `(i0,i1,i2), (i0,i2,i3), …`. Polygons with fewer
 * than 3 indices are dropped (degenerate).
 */
export function fanTriangulate(indices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i + 1 < indices.length; i++) {
    out.push(indices[0]!, indices[i]!, indices[i + 1]!);
  }
  return out;
}
