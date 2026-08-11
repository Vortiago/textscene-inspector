import { packedArrayCallAnywhere, packedArrayLiteral } from '../../godot/index.js';

const PACKED_VECTOR3_ARRAY_RE = packedArrayLiteral('PackedVector3Array');

/** Parse Godot `PackedVector3Array(x, y, z, x, y, z, ...)` into a flat Float32Array. */
export function parsePackedVector3Array(value: string): Float32Array {
  const match = PACKED_VECTOR3_ARRAY_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid PackedVector3Array format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return new Float32Array(0);
  const nums = inner.split(',').map((s) => parseFloat(s.trim()));
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid number in PackedVector3Array: ${value}`);
  }
  return new Float32Array(nums);
}

/** Parse Godot `PackedVector2Array(x, y, x, y, ...)` into a flat Float32Array. */
export function parsePackedVector2Array(value: string): Float32Array {
  const match = value.match(/^PackedVector2Array\s*\(([\s\S]*)\)$/);
  if (!match) {
    throw new Error(`Invalid PackedVector2Array format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return new Float32Array(0);
  const nums = inner.split(',').map((s) => parseFloat(s.trim()));
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid number in PackedVector2Array: ${value}`);
  }
  return new Float32Array(nums);
}

/** Parse Godot `PackedColorArray(r, g, b, a, r, g, b, a, ...)` into a flat Float32Array. */
export function parsePackedColorArray(value: string): Float32Array {
  const match = value.match(/^PackedColorArray\s*\(([\s\S]*)\)$/);
  if (!match) {
    throw new Error(`Invalid PackedColorArray format: ${value}`);
  }
  const inner = match[1]!.trim();
  if (inner === '') return new Float32Array(0);
  const nums = inner.split(',').map((s) => parseFloat(s.trim()));
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid number in PackedColorArray: ${value}`);
  }
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
    result.push(body.split(',').map((s) => parseInt(s.trim(), 10)));
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
