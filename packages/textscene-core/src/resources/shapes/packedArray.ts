import {
  packedArrayBody,
  packedArrayCallAnywhere,
  packedArrayForms,
  packedArrayLiteral,
  packedElementType,
  parseGodotFloat,
  parseGodotInt,
  splitTopLevel,
} from '../../godot/index.js';
import { arrayLiteralBody } from '../../godot/variantParser.js';

const PACKED_VECTOR3_ARRAY_FORMS = packedArrayForms('PackedVector3Array');
const PACKED_VECTOR2_ARRAY_FORMS = packedArrayForms('PackedVector2Array');
const PACKED_COLOR_ARRAY_FORMS = packedArrayForms('PackedColorArray');

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
 * A packed tuple slot in any of its three spellings, as the packed constructor's
 * flat components. The bare and typed bodies hold one `Vector2(…)` / `Vector3(…)` /
 * `Color(…)` per top-level comma, read at the slot's arity. Another arity throws
 * rather than add a short vertex: Godot makes no such conversion.
 */
function packedTupleFloats(
  value: string,
  wrapper: string,
  forms: readonly RegExp[],
  groupSize: number
): Float32Array {
  return new Float32Array(packedTupleNumbers(value, wrapper, forms, groupSize));
}

/**
 * The same read at double precision, for a caller grouping components into
 * typed values: `Gradient`'s colour stops must not round the `.tres`'s `0.6` to
 * float32's `0.6000000238418579`. Geometry callers take the `Float32Array`.
 */
export function packedTupleNumbers(
  value: string,
  wrapper: string,
  forms: readonly RegExp[],
  groupSize: number
): number[] {
  const matched = packedArrayBody(forms, value);
  if (!matched) throw new Error(`Invalid ${wrapper} format: ${value}`);
  if (matched.body === '') return [];
  if (matched.flat) return floatElements(matched.body, wrapper, value);

  const elementRe = packedArrayLiteral(packedElementType(wrapper));
  const out: number[] = [];
  for (const part of splitTopLevel(matched.body)) {
    // A trailing comma leaves one empty part, and Godot's array reader closes on
    // the bracket before demanding another value (variant_parser.cpp:1658-1662),
    // so it is no element. The validator skips it the same way.
    if (part === '') continue;
    const element = elementRe.exec(part);
    if (!element) throw new Error(`Invalid ${wrapper} format: ${value}`);
    const components = floatElements(element[1]!, wrapper, value);
    if (components.length !== groupSize) throw new Error(`Invalid ${wrapper} format: ${value}`);
    out.push(...components);
  }
  return out;
}

/** The forms of a `PackedColorArray` slot, for a caller grouping its components itself. */
export const PACKED_COLOR_ARRAY_SPELLINGS = PACKED_COLOR_ARRAY_FORMS;

/** Parse a Godot `PackedVector3Array` slot into a flat Float32Array. */
export function parsePackedVector3Array(value: string): Float32Array {
  return packedTupleFloats(value, 'PackedVector3Array', PACKED_VECTOR3_ARRAY_FORMS, 3);
}

/** Parse a Godot `PackedVector2Array` slot into a flat Float32Array. */
export function parsePackedVector2Array(value: string): Float32Array {
  return packedTupleFloats(value, 'PackedVector2Array', PACKED_VECTOR2_ARRAY_FORMS, 2);
}

/** Parse a Godot `PackedColorArray` slot into a flat Float32Array. */
export function parsePackedColorArray(value: string): Float32Array {
  return packedTupleFloats(value, 'PackedColorArray', PACKED_COLOR_ARRAY_FORMS, 4);
}

/** One `[...]` group nested inside an outer array, its body captured. */
const BARE_INNER_ARRAY_RE = /\[([^[\]]*)\]/g;

/**
 * Every sub-array of indices, in each spelling Godot loads: `[PackedInt32Array(...), ...]`,
 * `Array[PackedInt32Array]([PackedInt32Array(...), ...])`, and `[[0, 1, 2], [0, 2, 3]]`.
 * The last is the declared untyped ARRAY (`polygon_2d.cpp:720`, and `set_polygons`
 * takes a `const Array &`), measured on 4.6.3 as two sub-polygons.
 */
export function parsePackedInt32Arrays(value: string): number[][] {
  const result: number[][] = [];
  const constructor = packedArrayCallAnywhere('PackedInt32Array', true);
  constructor.lastIndex = 0;
  let re = constructor;
  let scanned = value;
  if (!constructor.test(value)) {
    // The outer brackets go first: a `[...]` scan over the whole value matches
    // them, so `[]` would read as one empty sub-polygon. `Array[T]([…])` loads too
    // (`can_convert_strict` lists ARRAY for every PACKED_* type), and unwrapping
    // it leaves the body the bare form scans.
    const outer = arrayLiteralBody(value);
    if (outer === null) return [];
    scanned = outer;
    re = BARE_INNER_ARRAY_RE;
  }
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(scanned)) !== null) {
    const body = match[1]!.trim();
    if (body === '') {
      result.push([]);
      continue;
    }
    result.push(
      body.split(',').map((s) => {
        const num = parseGodotInt(s);
        // A body Godot's tokenizer refuses throws rather than become a NaN
        // index, and `2e1` reads as the 20 Godot loads. A non-finite would clear
        // every range check and index arbitrary geometry.
        if (num === null || !Number.isFinite(num)) {
          throw new Error(`Invalid number in PackedInt32Array: ${value}`);
        }
        return num;
      })
    );
  }
  return result;
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
