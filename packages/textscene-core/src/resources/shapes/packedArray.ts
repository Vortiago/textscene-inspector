/**
 * Readers for Godot's packed array slots, THREE-free: a flat float body, the three spellings
 * of a packed tuple slot, one element of its flat components, and the nested index arrays of a
 * polygon list.
 */
import { parseGodotFloat } from '../../godot/variant/number.js';
import { int32Elements } from '../../godot/variant/packedInt32.js';
import { splitTopLevel } from '../../godot/string/string.js';
import type { Rgba } from '../../godot/math/math.js';
import type { Vector2, Vector3 } from '../../godot/math/vector.js';
import {
  packedArrayBody,
  packedArrayCallAnywhere,
  packedArrayForms,
  packedArrayLiteral,
  packedElementType,
  arrayLiteralBody,
} from '../../godot/variant/variantParser.js';

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
 * A packed tuple slot in any of its three spellings, as the constructor's flat components. The
 * bare and typed bodies hold one element per top-level comma, and another group size throws
 * rather than add a short vertex: Godot makes no such conversion.
 */
function packedTupleNumbers(value: string, type: PackedTupleType): number[] {
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

const PACKED_VECTOR3 = packedTupleType('PackedVector3Array', 3);
const PACKED_VECTOR2 = packedTupleType('PackedVector2Array', 2);
const PACKED_COLOR = packedTupleType('PackedColorArray', 4);

/** A Godot `PackedVector3Array` slot as flat components. */
export const parsePackedVector3Array = float32Reader(PACKED_VECTOR3);

/** A Godot `PackedVector2Array` slot as flat components. */
export const parsePackedVector2Array = float32Reader(PACKED_VECTOR2);

/** A Godot `PackedColorArray` slot as flat components. */
export const parsePackedColorArray = float32Reader(PACKED_COLOR);

/**
 * The flat components of a packed slot that holds no element. Shared, as a zero-length array holds
 * nothing to write.
 *
 * @canonical Empty flat packed array
 */
export const NO_FLOATS = new Float32Array(0);

/** @canonical Element count of a flat PackedVector2Array */
export function vector2Count(flat: Float32Array): number {
  return flat.length / PACKED_VECTOR2.groupSize;
}

/** @canonical Element of a flat PackedVector2Array */
export function vector2At(flat: Float32Array, index: number): Vector2 {
  const at = index * PACKED_VECTOR2.groupSize;
  return { x: flat[at]!, y: flat[at + 1]! };
}

/** @canonical Element count of a flat PackedVector3Array */
export function vector3Count(flat: Float32Array): number {
  return flat.length / PACKED_VECTOR3.groupSize;
}

/** @canonical Element of a flat PackedVector3Array */
export function vector3At(flat: Float32Array, index: number): Vector3 {
  const at = index * PACKED_VECTOR3.groupSize;
  return { x: flat[at]!, y: flat[at + 1]!, z: flat[at + 2]! };
}

/** @canonical Element count of a flat PackedColorArray */
export function colorCount(flat: Float32Array): number {
  return flat.length / PACKED_COLOR.groupSize;
}

/** @canonical Element of a flat PackedColorArray */
export function colorAt(flat: Float32Array, index: number): Rgba {
  const at = index * PACKED_COLOR.groupSize;
  return { r: flat[at]!, g: flat[at + 1]!, b: flat[at + 2]!, a: flat[at + 3]! };
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
  return subArrayBodies(value).map((body) => parseIndices(body, value));
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
  const indices = int32Elements(body);
  // A body Godot's tokenizer refuses throws rather than become a NaN
  // index, and `2e1` reads as the 20 Godot loads. An unstorable element would
  // clear every range check and index arbitrary geometry.
  if (indices === null || indices.some(Number.isNaN)) {
    throw new Error(`Invalid number in PackedInt32Array: ${value}`);
  }
  return indices;
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
