import {
  packedArrayCallAnywhere,
  packedArrayLiteral,
  parseGodotFloat,
  parseGodotInt,
} from '../../godot/index.js';

const PACKED_VECTOR3_ARRAY_RE = packedArrayLiteral('PackedVector3Array');
const PACKED_VECTOR2_ARRAY_RE = packedArrayLiteral('PackedVector2Array');
const PACKED_COLOR_ARRAY_RE = packedArrayLiteral('PackedColorArray');

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

/** Parse Godot `PackedVector3Array(x, y, z, x, y, z, ...)` into a flat Float32Array. */
export function parsePackedVector3Array(value: string): Float32Array {
  const match = PACKED_VECTOR3_ARRAY_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid PackedVector3Array format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return new Float32Array(0);
  const nums = floatElements(inner, 'PackedVector3Array', value);
  return new Float32Array(nums);
}

/** Parse Godot `PackedVector2Array(x, y, x, y, ...)` into a flat Float32Array. */
export function parsePackedVector2Array(value: string): Float32Array {
  const match = PACKED_VECTOR2_ARRAY_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid PackedVector2Array format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return new Float32Array(0);
  const nums = floatElements(inner, 'PackedVector2Array', value);
  return new Float32Array(nums);
}

/** Parse Godot `PackedColorArray(r, g, b, a, r, g, b, a, ...)` into a flat Float32Array. */
export function parsePackedColorArray(value: string): Float32Array {
  const match = PACKED_COLOR_ARRAY_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid PackedColorArray format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return new Float32Array(0);
  const nums = floatElements(inner, 'PackedColorArray', value);
  return new Float32Array(nums);
}

/**
 * Extract every `PackedInt32Array(...)` from a value, regardless of wrapper —
 * handles both the bare 3D form `[PackedInt32Array(...), ...]` and the 2D
 * `Array[PackedInt32Array]([PackedInt32Array(...), ...])` form. Each becomes a
 * `number[]` of indices (navigation polygon vertex lists).
 */
export function parsePackedInt32Arrays(value: string): number[][] {
  const result: number[][] = [];
  const re = packedArrayCallAnywhere('PackedInt32Array', true);
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
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
