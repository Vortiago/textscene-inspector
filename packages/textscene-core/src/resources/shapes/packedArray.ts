import {
  ARRAY_LITERAL_RE,
  TYPED_WRAPPER_RE,
  packedArrayBody,
  packedArrayCallAnywhere,
  packedArrayForms,
  packedArrayLiteral,
  packedElementType,
  parseGodotFloat,
  parseGodotInt,
  splitTopLevel,
} from '../../godot/index.js';

const PACKED_VECTOR3_ARRAY_FORMS = packedArrayForms('PackedVector3Array');
const PACKED_VECTOR2_ARRAY_FORMS = packedArrayForms('PackedVector2Array');
const PACKED_COLOR_ARRAY_FORMS = packedArrayForms('PackedColorArray');

/**
 * Elements of a packed FLOAT body, as Godot's tokenizer reads them.
 *
 * `parseFloat` stops at the first unusable character, so `1.2.3` became 1.2 —
 * a vertex the file does not contain — and `+1` / `.5` slipped through as
 * numbers Godot refuses to load at all.
 *
 * A non-finite is a LEGAL element the writer emits (`rtos_fix`) and still
 * throws: every caller catches and falls back to drawing nothing, and
 * substituting 0 would put a vertex at the origin that the scene never asked
 * for. Undrawable and unreadable take the same exit deliberately.
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
 * A packed TUPLE slot in any of the three spellings it takes, flattened to the
 * components the packed constructor would have listed.
 *
 * The packed body is one FLAT argument list; the bare and typed bodies hold one
 * `Vector2(…)` / `Vector3(…)` / `Color(…)` element per top-level comma, so they
 * are split and each element's own body is read at the slot's arity. An element
 * of another arity is a conversion Godot does not make, so it throws with the
 * rest of the malformed text rather than contributing a short vertex.
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
 * The same read, at DOUBLE precision.
 *
 * Split out because the geometry callers want the `Float32Array` a buffer
 * attribute takes, while a caller that groups the components into typed values
 * — `Gradient`'s colour stops — must not round them: the `.tres` states
 * `0.6` and a float32 round-trip reports `0.6000000238418579`.
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
 * Extract every sub-array of indices from a value, in any spelling Godot loads:
 * the bare 3D form `[PackedInt32Array(...), ...]`, the 2D
 * `Array[PackedInt32Array]([PackedInt32Array(...), ...])` form, and the plain
 * `[[0, 1, 2], [0, 2, 3]]` form. Each becomes a `number[]`.
 *
 * The plain form is not a variant of the others, it is the untyped ARRAY the
 * property is actually declared as: `polygon_2d.cpp:720` is
 * `PropertyInfo(Variant::ARRAY, "polygons")` and `set_polygons` takes a
 * `const Array &`, so nothing converts and nothing refuses. Measured on 4.6.3,
 * `polygons = [[0, 1, 2], [0, 2, 3]]` loads as two sub-polygons.
 *
 * Scanning for the CONSTRUCTOR alone made that value yield zero iterations and
 * return `[]` without throwing — so the caller read "no sub-polygons" and
 * fan-triangulated the whole outline, while the strict parser (widened for this
 * same spelling) reported the file clean. Neither layer said anything.
 */
export function parsePackedInt32Arrays(value: string): number[][] {
  const result: number[][] = [];
  const constructor = packedArrayCallAnywhere('PackedInt32Array', true);
  constructor.lastIndex = 0;
  let re = constructor;
  let scanned = value;
  if (!constructor.test(value)) {
    // The OUTER brackets are stripped first: scanning `[...]` over the whole
    // value matches them too, so `[]` — no sub-polygons — read as one empty
    // sub-polygon and the caller drew a degenerate triangle fan.
    //
    // `Array[T]([…])` is the third spelling that loads. `can_convert_strict`
    // lists ARRAY as a source for every PACKED_* type, so a typed array of bare
    // element arrays converts element-wise; unwrapping it here and then
    // stripping its inner brackets leaves the same body the bare form scans.
    const trimmed = value.trim();
    const typed = TYPED_WRAPPER_RE.exec(trimmed);
    const literal = typed ? trimmed.slice(trimmed.indexOf('(') + 1, -1).trim() : trimmed;
    const outer = ARRAY_LITERAL_RE.exec(literal);
    if (!outer) return [];
    scanned = outer[1]!;
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
        // The guard its three float siblings already have. Without it a body
        // Godot's tokenizer refuses became a silent NaN index, and `2e1` — a
        // file Godot loads as 20 — became 2. A non-finite reads as NaN, which
        // clears every range check and would index arbitrary geometry.
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
